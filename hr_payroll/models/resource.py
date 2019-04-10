# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.osv.expression import AND
from odoo.tools import float_compare
from datetime import datetime

from odoo import models, fields, api


class ResourceCalendar(models.Model):
    _inherit = 'resource.calendar'

    hours_per_week = fields.Float(compute="_compute_hours_per_week", string="Hours per Week", store=True)
    full_time_required_hours = fields.Float(string="Fulltime Hours", help="Number of hours to work to be considered as fulltime.")
    is_fulltime = fields.Boolean(compute='_compute_is_fulltime', string="Is Full Time")
    work_time_rate = fields.Float(string='Work time rate', compute='_compute_work_time_rate', help='Work time rate versus full time working schedule, should be between 0 and 100 %.')

    @api.depends('attendance_ids.hour_from', 'attendance_ids.hour_to')
    def _compute_hours_per_week(self):
        for calendar in self:
            calendar.hours_per_week = sum((attendance.hour_to - attendance.hour_from) for attendance in calendar.attendance_ids)

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


class ResourceCalendarAttendance(models.Model):
    _inherit = 'resource.calendar.attendance'

    def _default_work_entry_type_id(self):
        return self.env.ref('hr_payroll.work_entry_type_attendance', raise_if_not_found=False)

    work_entry_type_id = fields.Many2one('hr.work.entry.type', 'Work Entry Type', default=_default_work_entry_type_id)


class ResourceCalendarLeave(models.Model):
    _inherit = 'resource.calendar.leaves'

    work_entry_type_id = fields.Many2one('hr.work.entry.type', 'Work Entry Type')
