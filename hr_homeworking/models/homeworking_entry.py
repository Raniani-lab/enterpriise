# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models


class HomeworkingEntry(models.Model):
    _name = "homeworking.entry"
    _description = "Homeworking entry"
    _rec_name = "location_id"
    _order = "date asc"

    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        if 'location_id' in fields_list and not res.get('location_id'):
            res['location_id'] = self.env['homeworking.location']._get_default_homeworking_location_id()
        return res

    employee_id = fields.Many2one('hr.employee', required=True, ondelete="cascade", readonly=True)
    location_id = fields.Many2one('homeworking.location', required=True)
    date = fields.Date(required=True)

    department_id = fields.Many2one(related="employee_id.department_id", store=True)
    company_id = fields.Many2one(related="employee_id.company_id")
    location_color = fields.Integer(related="location_id.color")
    job_id = fields.Many2one(related="employee_id.job_id", store=True)

    _sql_constraints = [
        ('employee_date_unique',
         'UNIQUE(employee_id, date)',
         'There cannot be multiple homeworking entries for the same employee/date pair.')
    ]

    def _clear_work_locations(self):
        """
        Reset the location of the homeworking entries to unspecified.
        """
        default_id = self.env['homeworking.location']._get_default_homeworking_location_id()
        self.write({'location_id': default_id})

    def _update_work_locations(self, work_locations):
        """Update the location of the homeworking entries to the given locations."""
        for day_index, weekday_location_id in enumerate(work_locations):
            if not weekday_location_id.id:
                continue
            weekday_entries = self.filtered(lambda entry: entry.date.weekday() == day_index)
            weekday_entries.write({'location_id': weekday_location_id.id})

    @api.model
    def _generation_window(self):
        return fields.Date.today() + relativedelta(day=31, months=1)

    @api.model
    def _cron_generate_homeworking_entries(self):
        employees_to_do = self.env['hr.employee'].search([
            '|',
            ('last_homeworking_entry_date', '=', False),
            ('last_homeworking_entry_date', '<', self._generation_window())])
        if not employees_to_do:
            return

        BATCH_SIZE = 100
        employees_to_do[:BATCH_SIZE]._generate_homeworking_entries()
        if len(employees_to_do) > BATCH_SIZE:
            self.env.ref('hr_homeworking.ir_cron_generate_homeworking_entries')._trigger()

    def get_entry_info(self):
        self.ensure_one()
        return {
            'employee_id': self.employee_id.id,
            'date': self.date,
            'homeworking_location_id': self.location_id.id
        }
