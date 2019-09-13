# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime

from dateutil.relativedelta import relativedelta
import logging

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


_logger = logging.getLogger(__name__)


class PlanningShift(models.Model):
    _inherit = 'planning.slot'

    project_id = fields.Many2one('project.project', string="Project", domain=[('allow_forecast', '=', True)])
    task_id = fields.Many2one('project.task', string="Task", domain="[('project_id', '=', project_id)]")

    _sql_constraints = [
        ('project_required_if_task', "CHECK( (task_id IS NOT NULL AND project_id IS NOT NULL) OR (task_id IS NULL) )", "If the planning is linked to a task, the project must be set too."),
    ]

    @api.onchange('task_id')
    def _onchange_task_id(self):
        if self.task_id:
            self.project_id = self.task_id.project_id

    @api.onchange('project_id')
    def _onchange_project_id(self):
        domain = [] if not self.project_id else [('project_id', '=', self.project_id.id)]
        result = {
            'domain': {'task_id': domain},
        }
        if self.task_id:
            self.task_id = False
        return result

    @api.constrains('task_id', 'project_id')
    def _check_task_in_project(self):
        for forecast in self:
            if forecast.task_id and (forecast.task_id not in forecast.project_id.tasks):
                raise ValidationError(_("Your task is not in the selected project."))
