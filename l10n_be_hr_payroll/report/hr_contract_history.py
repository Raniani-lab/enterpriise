# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from collections import defaultdict

class ContractHistory(models.Model):
    _inherit = 'hr.contract.history'

    time_credit = fields.Boolean('Credit time', readonly=True, help='This is a credit time contract.')
    standard_calendar_id = fields.Many2one('resource.calendar', readonly=True)
    time_credit_full_time_wage = fields.Monetary('Credit Time Full Time Wage', readonly=True)
    fiscal_voluntarism = fields.Boolean(
        string='Fiscal Voluntarism', readonly=True,
        help='Voluntarily increase withholding tax rate.')
    fiscal_voluntary_rate = fields.Float(string='Fiscal Voluntary Rate', readonly=True,
        help='Should be between 0 and 100 %')
    attachment_salary_ids = fields.One2many('l10n_be.attachment.salary', 'contract_id', readonly=True)
    wage_type = fields.Selection(related='structure_type_id.wage_type', readonly=True)

    @api.depends('contract_ids')
    def _compute_reference_data(self):
        non_credit_time_contracts_history = self.filtered(lambda contract_history: not contract_history.time_credit)
        credit_time_contracts_history = self.filtered(lambda contract_history: contract_history.time_credit)

        super(ContractHistory, non_credit_time_contracts_history)._compute_reference_data()

        mapped_employee_contract = defaultdict(lambda: self.env['hr.contract'],
                                               [(c.employee_id, c) for c in credit_time_contracts_history.mapped('contract_id')])
        for history in self:
            history.reference_monthly_wage = mapped_employee_contract[history.employee_id].time_credit_full_time_wage
            history.reference_yearly_cost = mapped_employee_contract[history.employee_id].final_yearly_costs

    def action_credit_time_wizard(self):
        self.ensure_one()
        action = self.env['ir.actions.actions']._for_xml_id('l10n_be_hr_payroll.credit_time_wizard_action')
        action['context'] = {'active_id': self.contract_id.id}
        return action

    def action_exit_credit_time_wizard(self):
        self.ensure_one()
        action = self.env['ir.actions.actions']._for_xml_id('l10n_be_hr_payroll.exit_credit_time_wizard_action')
        action['context'] = {'active_id': self.contract_id.id}
        return action

