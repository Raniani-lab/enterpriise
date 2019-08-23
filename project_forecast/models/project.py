# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, exceptions, fields, models, _
from odoo.exceptions import UserError


class Project(models.Model):
    _inherit = 'project.project'

    allow_forecast = fields.Boolean("Forecast", default=False, help="Enable forecasting on the project.")

    def write(self, vals):
        if 'active' in vals:
            self.env['project.forecast'].with_context(active_test=False).search([('project_id', 'in', self.ids)]).write({'active': vals['active']})
        return super(Project, self).write(vals)

    def unlink(self):
        if self.env['project.forecast'].search([('project_id', 'in', self.ids)]):
            raise UserError(_('You cannot delete a project containing forecasts. You can either delete all the project\'s forecasts and then delete the project or simply deactivate the project.'))
        return super(Project, self).unlink()


class Task(models.Model):
    _inherit = 'project.task'

    allow_forecast = fields.Boolean('Forecast', readonly=True, related='project_id.allow_forecast', store=False)

    def write(self, vals):
        if 'active' in vals:
            self.env['project.forecast'].with_context(active_test=False).search([('task_id', 'in', self.ids)]).write({'active': vals['active']})
        return super(Task, self).write(vals)

    def unlink(self):
        if self.env['project.forecast'].search([('task_id', 'in', self.ids)]):
            raise UserError(_('You cannot delete a task containing forecasts. You can either delete all the task\'s forecasts and then delete the task or simply deactivate the task.'))
        return super(Task, self).unlink()
