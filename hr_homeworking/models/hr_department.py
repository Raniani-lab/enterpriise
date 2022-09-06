# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


import datetime

from odoo import api, fields, models


class HrDepartment(models.Model):
    _inherit = 'hr.department'

    homeworking_schedule_ids = fields.One2many(
        comodel_name='homeworking.schedule',
        inverse_name='department_id',
        domain=lambda self: ['|', ('date_end', '=', False), ('date_end', '>=', datetime.date.today())])

    employees_at_home = fields.Integer(
        compute='_compute_homeworking_numbers',
        string="Working at Home")
    employees_in_office = fields.Integer(
        compute='_compute_homeworking_numbers',
        string="Working in the Office")
    employees_unspecified = fields.Integer(
        compute='_compute_homeworking_numbers',
        string="Working at unspecified location")

    @api.depends('member_ids')
    def _compute_homeworking_numbers(self):
        for department in self:
            members = department.member_ids
            vals = {'employees_at_home': 0, 'employees_in_office': 0, 'employees_unspecified': 0}
            for member in members:
                location = member.homeworking_current_location_id
                if location.location_type == 'home':
                    vals['employees_at_home'] += 1
                elif location.location_type == 'office':
                    vals['employees_in_office'] += 1
                elif location.location_type == 'unspecified':
                    vals['employees_unspecified'] += 1
            department.write(vals)

    def _uses_own_schedules(self):
        return True

    def _search_homeworking_entries(self, start_date, end_date, homeworking_exceptions=True):
        employees = self.env['hr.employee'].search([
            ('department_id', 'in', self.ids),
            ('has_specific_homeworking_policy', '=', False)])
        return employees._search_homeworking_entries(start_date, end_date, homeworking_exceptions)

    def _clear_work_locations(self, start_date, end_date):
        # For departments, we do not clear homeworking entries in the past as we can't know the exact department history
        # the employees have followed.
        self._search_homeworking_entries(
            max(start_date, fields.Date.context_today(self.env.user)),
            end_date,
            homeworking_exceptions=False
        )._clear_work_locations()

    def _update_work_locations(self, start_date, end_date, work_locations):
        # For departments, we do not update homeworking entries in the past as we can't know the exact department history
        # the employees have followed.
        self._search_homeworking_entries(
            max(start_date, fields.Date.context_today(self.env.user)),
            end_date,
            homeworking_exceptions=False
        )._update_work_locations(work_locations)
