# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, exceptions, fields, models, _
from odoo.exceptions import UserError


class Project(models.Model):
    _inherit = 'project.project'

    allow_forecast = fields.Boolean("Allow forecast", default=False, help="Enable forecasting on the project.")

    @api.multi
    def write(self, vals):
        if 'active' in vals:
            self.env['project.forecast'].with_context(active_test=False).search([('project_id', 'in', self.ids)]).write({'active': vals['active']})
        return super(Project, self).write(vals)

    @api.multi
    def unlink(self):
        if self.env['project.forecast'].search([('project_id', 'in', self.ids)]):
            raise UserError(_('You cannot delete a project containing forecasts. You can either delete all the project\'s forecasts and then delete the project or simply deactivate the project.'))
        return super(Project, self).unlink()

    def action_view_project_forecast(self):
        Forecast = self.env['project.forecast'].with_context(active_id=self.id)
        return Forecast.action_view_forecast('project_forecast.project_forecast_action_by_project')


class Task(models.Model):
    _inherit = 'project.task'

    allow_forecast = fields.Boolean('Allow Forecast', readonly=True, related='project_id.allow_forecast', store=False)

    @api.multi
    def write(self, vals):
        if 'active' in vals:
            self.env['project.forecast'].with_context(active_test=False).search([('task_id', 'in', self.ids)]).write({'active': vals['active']})
        return super(Task, self).write(vals)

    @api.multi
    def unlink(self):
        if self.env['project.forecast'].search([('task_id', 'in', self.ids)]):
            raise UserError(_('You cannot delete a task containing forecasts. You can either delete all the task\'s forecasts and then delete the task or simply deactivate the task.'))
        return super(Task, self).unlink()
