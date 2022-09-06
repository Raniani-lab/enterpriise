# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HomeworkingException(models.Model):
    _name = "homeworking.exception"
    _description = "Homeworking exception"
    _order = "date asc"

    employee_id = fields.Many2one('hr.employee', required=True, ondelete="cascade", readonly=True)
    homeworking_location_id = fields.Many2one('homeworking.location', required=True)
    date = fields.Date(required=True)

    _sql_constraints = [
        ('employee_date_unique',
         'UNIQUE(employee_id, date)',
         'There cannot be multiple schedule exceptions for the same employee/date pair.')
    ]

    @api.model_create_multi
    def create(self, vals_list):
        exceptions = super().create(vals_list)
        exceptions._set_homeworking_entry_locations()
        return exceptions

    def write(self, vals):
        if 'date' in vals:
            self._reset_homeworking_entry_locations()
        result = super().write(vals)
        self._set_homeworking_entry_locations()
        return result

    def unlink(self):
        self._reset_homeworking_entry_locations()
        return super().unlink()

    def _set_homeworking_entry_locations(self):
        for exception in self:
            exception.employee_id._search_homeworking_entries(exception.date, exception.date).write({
                'location_id': exception.homeworking_location_id.id
            })

    def _reset_homeworking_entry_locations(self):
        """
        Resets the location of the homeworking entries on the given
        date for the given location back to that specified by
        the schedule they are following.
        """
        new_homeworking_location_id = self.env['homeworking.location']._get_default_homeworking_location_id()
        for exception in self:
            current_schedule = exception.employee_id._find_homeworking_schedule(exception.date)
            if current_schedule:
                new_homeworking_location_id = current_schedule._get_week_work_locations()[exception.date.weekday()].id
            exception.employee_id._search_homeworking_entries(exception.date, exception.date).write({
                'location_id': new_homeworking_location_id
            })
