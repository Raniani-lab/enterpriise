# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Project(models.Model):
    _inherit = "project.project"

    total_planned_amount = fields.Monetary(related='analytic_account_id.total_planned_amount')

    def action_view_budget_lines(self):
        self.ensure_one()
        budget_lines = self.analytic_account_id.crossovered_budget_line
        return {
            "type": "ir.actions.act_window",
            "res_model": "crossovered.budget.lines",
            "domain": [['id', 'in', budget_lines.ids]],
            "name": "Budget Items",
            'view_mode': 'tree,form',
        }
