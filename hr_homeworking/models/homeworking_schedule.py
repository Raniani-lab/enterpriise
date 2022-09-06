# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools import get_timedelta
from odoo.tools.translate import _

LOCATION_FIELDS = [
    'monday_location_id',
    'tuesday_location_id',
    'wednesday_location_id',
    'thursday_location_id',
    'friday_location_id',
    'saturday_location_id',
    'sunday_location_id',
]


class HomeworkingSchedule(models.Model):
    _name = "homeworking.schedule"
    _description = "Homeworking Schedule"
    _order = "date_start asc"

    def default_get(self, fields_list):
        # Remove the default_department_id from the context so it doesn't get
        # passed along through the department kanban view and tries to create
        # a personal homeworking schedule with an associated department_id.
        if 'default_department_id' in self.env.context:
            ctx = {key: vals for key, vals in self.env.context.items() if key != 'default_department_id'}
            self = self.with_context(ctx)
        defaults = super().default_get(fields_list)
        default_location_id = self.env['homeworking.location']._get_default_homeworking_location_id()
        defaults.update({day: default_location_id for day in LOCATION_FIELDS if day in fields_list and not defaults.get(day)})
        return defaults

    # Could be defined either for a whole department, or a specific employee
    department_id = fields.Many2one('hr.department', ondelete="cascade")
    employee_id = fields.Many2one('hr.employee', ondelete="cascade")

    company_id = fields.Many2one('res.company', compute="_compute_company_id", store=True)
    date_start = fields.Date(
        required=True,
        default=lambda s: fields.Date.context_today(s.env.user))
    date_end = fields.Date("Date End")

    # The default location for these fields is set by overriding default_get
    monday_location_id = fields.Many2one('homeworking.location', required=True, string="Monday")
    tuesday_location_id = fields.Many2one('homeworking.location', required=True, string="Tuesday")
    wednesday_location_id = fields.Many2one('homeworking.location', required=True, string="Wednesday")
    thursday_location_id = fields.Many2one('homeworking.location', required=True, string="Thursday")
    friday_location_id = fields.Many2one('homeworking.location', required=True, string="Friday")
    saturday_location_id = fields.Many2one('homeworking.location', required=True, string="Saturday")
    sunday_location_id = fields.Many2one('homeworking.location', required=True, string="Sunday")

    _sql_constraints = [
        ('compatible_start_and_end_dates',
         'CHECK(date_start <= date_end or date_end is NULL)',
         'The end date cannot fall before the start date.'),
        ('non_null_associated_entity',
         'CHECK((employee_id IS NOT NULL OR department_id IS NOT NULL) AND '
         '      (employee_id IS NULL OR department_id IS NULL))',
         'Either an employee or department needs to be associated with this schedule, but not both.')
    ]

    @api.depends('employee_id', 'department_id')
    def _compute_company_id(self):
        for schedule in self:
            schedule.company_id = schedule.employee_id.company_id if schedule.employee_id else schedule.department_id.company_id

    @api.constrains('date_start', 'date_end')
    def _check_schedule_conflicts(self):
        min_date_start = min(self.mapped('date_start'))
        related_schedules = self.search(['|', ('employee_id', 'in', self.employee_id.ids), ('department_id', 'in', self.department_id.ids),
                                        '|', ('date_end', '>=', min_date_start), ('date_end', '=', False)])
        for schedule in self:
            conflicts = related_schedules.filtered_domain([
                ('id', '!=', schedule.id),
                ('employee_id', '=', schedule.employee_id.id) if schedule.employee_id else ('department_id', '=', schedule.department_id.id),
                '|', ('date_end', '>=', schedule.date_start), ('date_end', '=', False),
                ('date_start', '<=', schedule.date_end) if schedule.date_end else (1, '=', 1)
            ])
            if conflicts:
                raise ValidationError(_("Schedule for %(employee_or_department)s from %(start)s to %(end)s overlaps with the schedule from %(conflict_start)s to %(conflict_end)s.",
                        employee_or_department=schedule._get_associated_entity().name,
                        start=schedule.date_start, end=schedule.date_end or "_",
                        conflict_start=conflicts[0].date_start, conflict_end=conflicts[0].date_end or "_"))

    def _get_associated_entity(self):
        self.ensure_one()
        return self.department_id or self.employee_id

    def _get_week_work_locations(self):
        self.ensure_one()
        return [self[location_field] for location_field in LOCATION_FIELDS]

    @api.model_create_multi
    def create(self, vals_list):
        max_start_date = fields.Date.to_date(max(vals['date_start'] for vals in vals_list))
        employee_ids = [vals['employee_id'] for vals in vals_list if vals.get('employee_id')]
        department_ids = [vals['department_id'] for vals in vals_list if vals.get('department_id')]
        schedules_without_end_date = self.search([('date_start', '<', max_start_date), ('date_end', '=', False), '|', ('employee_id', 'in', employee_ids), ('department_id', 'in', department_ids)])

        for vals in vals_list:
            schedule_start = fields.Date.to_date(vals['date_start'])
            schedules_to_end = schedules_without_end_date.filtered_domain([
                ('employee_id', '=', vals['employee_id']) if vals.get('employee_id') else ('department_id', '=', vals['department_id']),
                ('date_start', '<', schedule_start)
            ])
            for schedule_to_end in schedules_to_end:
                schedule_to_end.date_end = schedule_start - timedelta(days=1)

        schedules = super().create(vals_list)
        for schedule in schedules:
            # Only update the homeworking entries if the created schedule is actually determining
            # the homeworking policy
            entity = schedule._get_associated_entity()
            if entity._uses_own_schedules():
                entity._update_work_locations(
                    schedule.date_start,
                    schedule.date_end,
                    schedule._get_week_work_locations())
        return schedules

    def write(self, vals):
        # Collect the previous values for the affected schedules for the efficient updating of homeworking entries
        updates = []
        for schedule in self:
            updates.append((
                schedule.date_start,
                schedule.date_end,
                schedule._get_associated_entity(),
                schedule._get_week_work_locations()))

        # Register the new values
        new_start = fields.Date.to_date(vals.get('date_start'))
        # new_end is False when explicitly set to nothing in the UI
        # and None when it is simply not present in the write values.
        new_end = fields.Date.to_date(vals.get('date_end')) if not('date_end' in vals and not vals['date_end']) else False

        new_work_locations = self.env['homeworking.location'].browse([vals.get(location) for location in LOCATION_FIELDS])

        # Write the values to the schedule
        res = super().write(vals)

        # Update the homeworking entries of the affected schedules.
        self._update_schedule_homeworking_entries(new_start, new_end, new_work_locations, updates)
        return res

    @api.model
    def _update_schedule_homeworking_entries(self, new_start, new_end, new_work_locations, update_list):
        """Update all the homeworking entries associated with the change in the schedules"""
        for previous_start, previous_end, associated_entity, schedule_work_locations in update_list:
            if not associated_entity._uses_own_schedules():
                continue
            combined_work_locations = []
            for index, new_work_location in enumerate(new_work_locations):
                combined_work_locations.append(new_work_location if new_work_location.id else schedule_work_locations[index])
            # Update the location_ids of the homeworking entries if the bounds of the schedule are widened.
            if new_start and new_start < previous_start:
                associated_entity._update_work_locations(
                    new_start,
                    previous_start - get_timedelta(1, 'day'),
                    combined_work_locations)

            # new_end is False when set to nothing and None when not present in the write values
            if new_end is not None and previous_end and (not new_end or new_end > previous_end):
                associated_entity._update_work_locations(
                    previous_end and previous_end + get_timedelta(1, 'day'),
                    new_end,
                    combined_work_locations)

            # Change the location of all entries outside the new schedule bounds to unspecified.
            if new_start and new_start > previous_start:
                associated_entity._clear_work_locations(previous_start, new_start - get_timedelta(1, 'day'))

            # If either new_end is False (for end date unknown) or None (not present in write values)
            # no entries need to be cleared
            if new_end and (not previous_end or new_end < previous_end):
                associated_entity._clear_work_locations(new_end and new_end + get_timedelta(1, 'day'), previous_end)

            # Update the location of the entries within the schedule bounds to the correct location
            # It's only necessary to update the entries within the old bounds, since the new bounds have already
            # been updated in the previous steps.
            associated_entity._update_work_locations(max(previous_start, new_start) if new_start else previous_start,
                                                     min(previous_end, new_end) if previous_end and new_end else previous_end or new_end,
                                                     new_work_locations)

    @api.model
    def _find_schedule(self, associated_entity, date):
        """
        Find the homeworking schedule for the given department or employee that contains the given date.
        (Should always be unique since there can't be any overlapping homeworking schedules for any single department or employee.)
        """
        if not associated_entity.homeworking_schedule_ids:
            return self.env['homeworking.schedule']
        potential_schedule = associated_entity.homeworking_schedule_ids.filtered(
            lambda s: s.date_start <= date and (not s.date_end or s.date_end >= date))
        return potential_schedule[0] if potential_schedule else self.env['homeworking.schedule']

    def unlink(self):
        for schedule in self:
            # Reset the location of all work_entries within the schedule bounds
            if schedule._get_associated_entity()._uses_own_schedules():
                schedule._get_associated_entity()._clear_work_locations(schedule.date_start, schedule.date_end)
        return super().unlink()
