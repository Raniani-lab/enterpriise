# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from datetime import datetime


class Project(models.Model):
    _inherit = 'project.project'

    allow_billable = fields.Boolean("Bill from Tasks")

    _sql_constraints = [
        ('timer_only_when_timesheet', "CHECK((allow_timesheets = 'f' AND allow_timesheet_timer = 'f') OR (allow_timesheets = 't'))", 'The timesheet timer can only be activated on project allowing timesheet.'),
    ]

    @api.onchange('allow_billable')
    def _onchange_allow_billable(self):
        """ In order to keep task billable type as 'task_rate' using sale_timesheet usual flow.
            (see _compute_billable_type method in sale_timesheet)
        """
        if self.allow_billable:
            self.sale_order_id = False
            self.sale_line_employee_ids = False


class ProjectTask(models.Model):
    _inherit = 'project.task'

    allow_billable = fields.Boolean(related="project_id.allow_billable")

    # ---------------------------------------------------------
    # Business Methods
    # ---------------------------------------------------------

    def action_make_billable(self):
        return {
            "name": _("Create Sales Order"),
            "type": 'ir.actions.act_window',
            "res_model": 'project.task.create.sale.order',
            "views": [[False, "form"]],
            "target": 'new',
            "context": {
                'active_id': self.id,
                'active_model': 'project.task',
                'form_view_initial_mode': 'edit',
            },
        }
