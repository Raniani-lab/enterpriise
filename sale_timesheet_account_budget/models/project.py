# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tools import format_amount

class Project(models.Model):
    _inherit = 'project.project'

    budget = fields.Integer('Total planned amount', compute='_compute_budget', default=0)

    @api.depends('analytic_account_id')
    def _compute_budget(self):
        budget_items = self.env['crossovered.budget.lines'].sudo()._read_group([
            ('analytic_account_id', 'in', self.analytic_account_id.ids)
        ], ['analytic_account_id'], ['planned_amount:sum'])
        budget_items_by_account_analytic = {analytic_account.id: planned_amount_sum for analytic_account, planned_amount_sum in budget_items}
        for project in self:
            project.budget = budget_items_by_account_analytic.get(project.analytic_account_id.id, 0.0)
