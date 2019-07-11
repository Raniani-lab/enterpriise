# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from datetime import datetime
from odoo.exceptions import UserError


class ProjectTaskCreateTimesheet(models.TransientModel):
    _name = 'project.task.create.timesheet'
    _description = "Create Timesheet from task"

    @api.model
    def default_get(self, fields):
        result = super(ProjectTaskCreateTimesheet, self).default_get(fields)
        active_model = self._context.get('active_model')
        if active_model != 'project.task':
            raise UserError(_("You can only apply this action from a task."))

        active_id = self._context.get('active_id')
        if 'task_id' in fields and active_id:
            task_id = self.env['project.task'].browse(active_id)
            result['task_id'] = active_id
            result['description'] = task_id.name
        return result

    time_spent = fields.Float('Time', precision_digits=2)
    description = fields.Char('Description')
    task_id = fields.Many2one('project.task', "Task", help="Task for which we are creating a sales order", required=True)

    def save_timesheet(self):
        values = {
            'task_id': self.task_id.id,
            'project_id': self.task_id.project_id.id,
            'date': datetime.now(),
            'name': self.description,
            'user_id': self.env.uid,
            'unit_amount': self.time_spent,
        }
        return self.env['account.analytic.line'].create(values)
