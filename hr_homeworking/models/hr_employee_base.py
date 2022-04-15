# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict
import datetime
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models


class HrHomeworkingBaseEmployee(models.AbstractModel):
    _inherit = 'hr.employee.base'

    homeworking_schedule_ids = fields.One2many(
        comodel_name='homeworking.schedule',
        inverse_name='employee_id',
        string="Homeworking Schedules")
    homeworking_department_schedule_ids = fields.One2many(
        comodel_name='homeworking.schedule',
        string='Department Schedules',
        related='department_id.homeworking_schedule_ids',
        domain=lambda self: ['|', ('date_end', '=', False), ('date_end', '>=', datetime.date.today())])
    has_active_department_schedules = fields.Boolean(compute='_compute_has_active_department_schedules')
    homeworking_exception_ids = fields.One2many(
        comodel_name='homeworking.exception',
        inverse_name='employee_id',
        string='Homeworking Exceptions')
    has_specific_homeworking_policy = fields.Boolean(string="Employee Specific Homeworking Policy")
    hr_icon_display = fields.Selection(selection_add=[
        ('presence_present_home', 'Present (home)'),
        ('presence_present_office', 'Present (office))'),
        ('presence_present_unspecified', 'Present (unspecified working location)'),
        ('presence_to_define_home', 'To define (home)'),
        ('presence_to_define_office', 'To define (office)'),
        ('presence_to_define_unspecified', 'To define (unspecified working location)'),
    ])
    homeworking_current_location_id = fields.Many2one(
        comodel_name='homeworking.location',
        compute='_compute_homeworking_current_location_id',
        inverse="_inverse_homeworking_current_location_id",
        search='_search_homeworking_current_location_id',
        string='Homeworking Current Location')
    last_homeworking_entry_date = fields.Date(string="Last Homeworking Entry Date")

    @api.depends('homeworking_current_location_id')
    def _compute_presence_icon(self):
        super()._compute_presence_icon()

        # All employees must have an icon
        self.show_hr_icon_display = True

        for employee in self:
            if employee.hr_icon_display in ['presence_present', 'presence_to_define'] and \
                    employee.homeworking_current_location_id.location_type in ['home', 'office', 'unspecified']:
                employee.hr_icon_display = '%s_%s' % (employee.hr_icon_display,
                                                      employee.homeworking_current_location_id.location_type)

    @api.depends('homeworking_department_schedule_ids')
    def _compute_has_active_department_schedules(self):
        for employee in self:
            employee.has_active_department_schedules = employee.homeworking_department_schedule_ids

    def _compute_homeworking_current_location_id(self):
        today = fields.Date.context_today(self.env.user)
        today_entries = self._search_homeworking_entries(today, today)

        entries_by_employee = defaultdict(lambda: self.env['homeworking.entry'])
        for entry in today_entries:
            entries_by_employee[entry.employee_id.id] = entry

        for employee in self:
            employee_entry = entries_by_employee[employee.id]
            employee.homeworking_current_location_id = employee_entry.location_id if employee_entry else False

    def _inverse_homeworking_current_location_id(self):
        self._create_homeworking_exception(fields.Date.context_today(self.env.user),
                                           self.homeworking_current_location_id)

    def _create_homeworking_exception(self, date, homeworking_location_id):
        existing_exceptions = self.env['homeworking.exception'].search([
            ('employee_id', 'in', self.ids),
            ('date', '=', date)])
        homeworking_exception_create_vals = []
        for employee in self:
            current_exception = existing_exceptions.filtered_domain([('employee_id', '=', employee.id)])
            if current_exception:
                current_exception.homeworking_location_id = homeworking_location_id
            else:
                homeworking_exception_create_vals.append({
                    'employee_id': employee.id,
                    'date': date,
                    'homeworking_location_id': homeworking_location_id.id
                })
        if homeworking_exception_create_vals:
            self.env['homeworking.exception'].create(homeworking_exception_create_vals)

    def _search_homeworking_current_location_id(self, operator, value):
        today = fields.Date.context_today(self.env.user)

        if operator in ['in', 'not in']:
            today_entries = self.env['homeworking.entry'].search([
                ('location_id', 'in', value),
                ('date', '=', today)])

        elif operator in ['=', '!=']:
            today_entries = self.env['homeworking.entry'].search([
                ('location_id.location_type', '=', value),
                ('date', '=', today)])
        else:
            return None

        return [('id', {"=": "in", "!=": "not in", "in": "in", "not in": "not in"}[operator],
                 list(set(entry.employee_id.id for entry in today_entries)))]

    def _uses_own_schedules(self):
        self.ensure_one()
        return self.has_specific_homeworking_policy

    def _find_homeworking_schedule(self, date):
        self.ensure_one()
        if not self.has_specific_homeworking_policy:
            return self.env['homeworking.schedule']._find_schedule(self.department_id, date)
        else:
            return self.env['homeworking.schedule']._find_schedule(self, date)

    @api.model_create_multi
    def create(self, vals_list):
        employees = super().create(vals_list)
        # If the employee does not have a department, we put them on their own personal schedule.
        employees.filtered(lambda e: not e.department_id).action_change_to_employee_schedule()
        employees._generate_homeworking_entries()
        return employees

    def write(self, vals):
        super().write(vals)

        # Update the homeworking.entry record's location if we change the 'has_specific_homeworking_policy' option.
        # Also remove personal schedules when switching to the department schedules.
        today = fields.Date.context_today(self.env.user)
        if 'has_specific_homeworking_policy' in vals:
            self._clear_work_locations(today, datetime.date.max)
            for employee in self:
                if not vals.get('has_specific_homeworking_policy'):
                    employee._end_personal_schedules()
                    for schedule in employee.department_id.homeworking_schedule_ids.filtered(lambda s: not s.date_end or s.date_end >= today):
                        employee._update_work_locations(schedule.date_start, schedule.date_end, schedule._get_week_work_locations())
                else:
                    for schedule in employee.homeworking_schedule_ids.filtered(lambda s: not s.date_end or s.date_end >= today):
                        employee._update_work_locations(schedule.date_start, schedule.date_end, schedule._get_week_work_locations())

        # Also update the homeworking.entry record's location if the employee changes departments.
        if 'department_id' in vals:
            department_schedule_employees = self.filtered(lambda e: not e.has_specific_homeworking_policy)
            department_schedule_employees._clear_work_locations(today, datetime.date.max)

            for employee in department_schedule_employees:
                for schedule in employee.department_id.homeworking_schedule_ids.filtered(lambda s: not s.date_end or s.date_end >= today):
                    employee._update_work_locations(schedule.date_start, schedule.date_end, schedule._get_week_work_locations())

            # If the employee loses their department, their homeworking policy will be set to personal.
            if not vals.get('department_id'):
                self.action_change_to_employee_schedule()

    def toggle_active(self):
        res = super().toggle_active()
        activated = self.filtered(lambda e: e.active)
        archived = self.filtered(lambda e: not e.active)
        if activated:
            activated._generate_homeworking_entries()
        if archived:
            today = fields.Date.today()
            archived._search_homeworking_entries(today, datetime.date.max).unlink()
            archived.last_homeworking_entry_date = today - relativedelta(days=1)
        return res

    def _search_homeworking_entries(self, start_date, end_date, homeworking_exceptions=True):
        search_domain = [
            ('employee_id', 'in', self.ids),
            ('date', '>=', start_date),
        ]
        if end_date:
            search_domain.append(('date', '<=', end_date))
        homeworking_entries = self.env['homeworking.entry'].sudo().search(search_domain)

        if not homeworking_exceptions:
            homeworking_entries_by_employee = defaultdict(lambda: self.env['homeworking.entry'])
            for entry in homeworking_entries:
                homeworking_entries_by_employee[entry.employee_id.id] += entry

            homeworking_entries = self.env['homeworking.entry']
            for employee in self:
                employee_entries = homeworking_entries_by_employee[employee.id]
                exception_dates = employee.homeworking_exception_ids.mapped('date')
                homeworking_entries |= employee_entries.filtered(lambda he: he.date not in exception_dates)

        return homeworking_entries

    def _clear_work_locations(self, start_date, end_date):
        """
        Reset the location of the employee's homeworking entries within the given bounds to unspecified or to
        the department schedule if specified.
        """
        self._search_homeworking_entries(
            start_date, end_date, homeworking_exceptions=False
        )._clear_work_locations()

    @api.model
    def _update_work_locations(self, start_date, end_date, work_locations):
        """Update the location of homeworking entries within the given bounds to the given locations."""
        self._search_homeworking_entries(
            start_date, end_date, homeworking_exceptions=False
        )._update_work_locations(work_locations)

    def action_change_to_employee_schedule(self):
        self.has_specific_homeworking_policy = True

    def action_change_to_department_schedule(self):
        self.has_specific_homeworking_policy = False

    def _end_personal_schedules(self):
        """End the current homeworking schedule and remove all future ones."""
        today = fields.Date.context_today(self.env.user)
        current_schedules = self.homeworking_schedule_ids.filtered(
            lambda s: (not s.date_end or s.date_end >= today) and today > s.date_start)
        if current_schedules:
            current_schedules.date_end = today - datetime.timedelta(days=1)
        future_schedules = self.homeworking_schedule_ids.filtered(lambda s: s.date_start >= today)
        if future_schedules:
            future_schedules.unlink()

    def _generate_homeworking_entries(self):
        date_start = fields.Date.today() + relativedelta(day=1)
        date_end = self.env['homeworking.entry']._generation_window()

        homeworking_exceptions = self.env['homeworking.exception'].search([
            ('employee_id', 'in', self.ids)])
        homeworking_exceptions_by_employee = defaultdict(lambda: self.env['homeworking.exception'])
        for exception in homeworking_exceptions:
            homeworking_exceptions_by_employee[exception.employee_id.id] += exception

        date_range = [date_start + datetime.timedelta(days=x) for x in range((date_end - date_start).days + 1)]
        entry_vals = []
        for employee in self:
            employee_start = date_start if not employee.last_homeworking_entry_date else max(employee.last_homeworking_entry_date + datetime.timedelta(days=1), date_start)
            employee_date_range = date_range[(employee_start - date_start).days:]
            employee_exceptions = homeworking_exceptions_by_employee[employee.id]
            employee_exceptions_by_date = {}
            for exception in employee_exceptions:
                employee_exceptions_by_date[exception.date] = exception.homeworking_location_id

            if not employee.has_specific_homeworking_policy:
                schedules = employee.department_id.homeworking_schedule_ids.filtered(
                    lambda s: (not s.date_end or s.date_end >= date_start) and s.date_start <= date_end
                )
            else:
                schedules = employee.homeworking_schedule_ids.filtered(
                    lambda s: (not s.date_end or s.date_end >= date_start) and s.date_start <= date_end
                )
            schedule_homeworking_locations = {}
            for schedule in schedules:
                schedule_homeworking_locations[schedule.id] = schedule._get_week_work_locations()

            for date in employee_date_range:
                vals = {
                    'date': date,
                    'employee_id': employee.id,
                }
                if date in employee_exceptions_by_date:
                    vals['location_id'] = employee_exceptions_by_date[date_start].id
                else:
                    for schedule in schedules:
                        if date >= schedule.date_start and (not schedule.date_end or date <= schedule.date_end):
                            vals['location_id'] = schedule_homeworking_locations[schedule.id][date.weekday()].id
                            break
                entry_vals.append(vals)
            if not employee.last_homeworking_entry_date or date_end > employee.last_homeworking_entry_date:
                employee.last_homeworking_entry_date = date_end
        return self.env['homeworking.entry'].create(entry_vals)
