# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.osv.expression import AND, OR
from odoo.tools import float_compare
from datetime import datetime

from odoo import models, fields, api
from odoo.addons.resource.models.resource_mixin import timezone_datetime

class ResourceCalendar(models.Model):
    _inherit = 'resource.calendar'

    @api.model
    def default_get(self, fields):
        res = super(ResourceCalendar, self).default_get(fields)
        res['normal_attendance_ids'] = res.pop('attendance_ids', None)
        return res

    hours_per_week = fields.Float(compute="_compute_hours_per_week", string="Hours per Week", store=True)
    full_time_required_hours = fields.Float(string="Fulltime Hours", help="Number of hours to work to be considered as fulltime.")
    is_fulltime = fields.Boolean(compute='_compute_is_fulltime', string="Is Full Time")
    work_time_rate = fields.Float(string='Work time rate', compute='_compute_work_time_rate', help='Work time rate versus full time working schedule, should be between 0 and 100 %.')

    # UI fields
    normal_attendance_ids = fields.One2many(
        'resource.calendar.attendance', 'calendar_id', 'Normal Working Time',
        domain=[('resource_id', '=', False)])

    extra_attendance_ids = fields.One2many(
        'resource.calendar.attendance', 'calendar_id', 'Employees Working Time',
        domain=[('resource_id', '!=', False)])

    @api.depends('normal_attendance_ids.hour_from', 'normal_attendance_ids.hour_to')
    def _compute_hours_per_week(self):
        for calendar in self:
            calendar.hours_per_week = sum((attendance.hour_to - attendance.hour_from) for attendance in calendar.normal_attendance_ids)

    def _compute_is_fulltime(self):
        for calendar in self:
            calendar.is_fulltime = not float_compare(calendar.full_time_required_hours, calendar.hours_per_week, 3)

    @api.depends('hours_per_week', 'full_time_required_hours')
    def _compute_work_time_rate(self):
        for calendar in self:
            if calendar.full_time_required_hours:
                calendar.work_time_rate = calendar.hours_per_week / calendar.full_time_required_hours * 100
            else:
                calendar.work_time_rate = 100


    def _get_global_attendances(self):
        return self.normal_attendance_ids.filtered(lambda attendance: not attendance.date_from and not attendance.date_to)

    # Add a key on the api.onchange decorator
    @api.onchange('attendance_ids', 'normal_attendance_ids')
    def _onchange_hours_per_day(self):
        return super(ResourceCalendar, self)._onchange_hours_per_day()

    @api.multi
    def transfer_leaves_to(self, other_calendar, resources=None, from_date=None):
        """
            Transfer some resource.calendar.leaves from 'self' to another calendar 'other_calendar'.
            Transfered leaves linked to `resources` (or all if `resources` is None) and starting
            after 'from_date' (or today if None).
        """
        from_date = from_date or datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        domain = [
            ('calendar_id', 'in', self.ids),
            ('date_from', '>=', from_date),
        ]
        domain = AND([domain, [('resource_id', 'in', resources.ids)]]) if resources else domain

        self.env['resource.calendar.leaves'].search(domain).write({
            'calendar_id': other_calendar.id,
        })


class ResourceCalendarAttendance(models.Model):
    _inherit = 'resource.calendar.attendance'

    def _default_work_entry_type_id(self):
        return self.env.ref('hr_payroll.work_entry_type_attendance', raise_if_not_found=False)

    work_entry_type_id = fields.Many2one('hr.work.entry.type', 'Work Entry Type', default=_default_work_entry_type_id)


class ResourceCalendarLeave(models.Model):
    _inherit = 'resource.calendar.leaves'

    work_entry_type_id = fields.Many2one('hr.work.entry.type', 'Work Entry Type')


class ResourceMixin(models.AbstractModel):
    _inherit = "resource.mixin"

    def _get_work_entry_days_data(self, work_entry_types, from_datetime, to_datetime, calendar=None):
        """
            By default the resource calendar is used, but it can be
            changed using the `calendar` argument.

            Returns a dict {'days': n, 'hours': h} containing the number of leaves
            expressed as days and as hours.
        """
        resource = self.resource_id
        calendar = calendar or self.resource_calendar_id
        type_leave = work_entry_types.filtered(lambda t: t.is_leave)
        type_attendance = work_entry_types - type_leave

        leave_domain = [('work_entry_type_id', 'in', type_leave.ids)]

        attendance_domain = [('work_entry_type_id', 'in', type_attendance.ids)]
        if self.env.ref('hr_payroll.work_entry_type_attendance', raise_if_not_found=False) in type_attendance:  # special case for global attendances
            attendance_domain = OR([attendance_domain, [('work_entry_type_id', '=', False)]]) # no work entry type = normal/global attendance

        # naive datetimes are made explicit in UTC
        from_datetime = timezone_datetime(from_datetime)
        to_datetime = timezone_datetime(to_datetime)

        day_total = self._get_day_total(from_datetime, to_datetime, calendar, resource)
        leave_intervals = calendar._attendance_intervals(from_datetime, to_datetime, resource) & calendar._leave_intervals(from_datetime, to_datetime, resource, leave_domain)  # use domain to only retrieve leaves of this type
        attendance_intervals = calendar._attendance_intervals(from_datetime, to_datetime, resource, attendance_domain) - calendar._leave_intervals(from_datetime, to_datetime, resource)

        return self._get_days_data(leave_intervals | attendance_intervals, day_total)
