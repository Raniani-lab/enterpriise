# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from collections import defaultdict


class ContractHistory(models.Model):
    _inherit = 'hr.contract.history'

    time_credit = fields.Boolean('Credit time', readonly=True, help='This is a credit time contract.')
    work_time_rate = fields.Float(string='Work time rate', help='Work time rate versus full time working schedule.')
    standard_calendar_id = fields.Many2one('resource.calendar', readonly=True)
    time_credit_full_time_wage = fields.Monetary('Credit Time Full Time Wage', readonly=True)

    @api.depends('contract_ids')
    def _compute_reference_data(self):
        non_credit_time_contracts_history = self.filtered(lambda contract_history: not contract_history.time_credit)
        credit_time_contracts_history = self.filtered(lambda contract_history: contract_history.time_credit)

        super(ContractHistory, non_credit_time_contracts_history)._compute_reference_data()

        mapped_employee_contract = defaultdict(lambda: self.env['hr.contract'],
                                               [(c.employee_id, c) for c in credit_time_contracts_history.mapped('contract_id')])
        for history in credit_time_contracts_history:
            history.reference_monthly_wage = mapped_employee_contract[history.employee_id].time_credit_full_time_wage
            history.reference_yearly_cost = mapped_employee_contract[history.employee_id].final_yearly_costs
