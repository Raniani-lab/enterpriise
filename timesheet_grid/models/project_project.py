# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Project(models.Model):
    _inherit = 'project.project'

    allow_timesheet_timer = fields.Boolean('Timesheet Timer', default=False, help="Use a timer to record timesheets on tasks")

    @api.onchange('allow_timesheets')
    def _onchange_allow_timesheets(self):
        if not self.allow_timesheets:
            self.allow_timesheet_timer = False

    def write(self, values):
        result = super(Project, self).write(values)
        if 'allow_timesheet_timer' in values and not values.get('allow_timesheet_timer'):
            self.env['project.task'].with_context(active_test=False).search([('project_id', 'in', self.ids)]).write({
                'timer_start': False,
                'timer_pause': False,
            })
        return result
