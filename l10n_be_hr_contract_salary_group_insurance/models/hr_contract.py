# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class HrContract(models.Model):
    _inherit = 'hr.contract'

    wage_with_holidays = fields.Monetary(
        string="Wage With Sacrifices",
        help="Adapted salary, according to the sacrifices defined on the contract (Example: Extra-legal time off, a percentage of the salary invested in a group insurance, etc...)")
    l10n_be_group_insurance_rate = fields.Float(
        string="Group Insurance Sacrifice Rate", tracking=True,
        help="Should be between 0 and 100 %")
    # ONSS Employer
    l10n_be_group_insurance_amount = fields.Monetary(
        compute='_compute_l10n_be_group_insurance_amount', store=True)
    l10n_be_group_insurance_cost = fields.Monetary(
        compute='_compute_l10n_be_group_insurance_amount', store=True)

    _sql_constraints = [
        ('check_percentage_group_insurance_rate', 'CHECK(l10n_be_group_insurance_rate >= 0 AND l10n_be_group_insurance_rate <= 100)', 'The group insurance salary sacrifice rate on wage should be between 0 and 100.'),
    ]

    @api.depends('holidays', 'wage', 'final_yearly_costs', 'l10n_be_group_insurance_rate')
    def _compute_wage_with_holidays(self):
        super()._compute_wage_with_holidays()

    @api.depends('wage', 'l10n_be_group_insurance_rate')
    def _compute_l10n_be_group_insurance_amount(self):
        for contract in self:
            rate = contract.l10n_be_group_insurance_rate
            insurance_amount = contract.wage * rate / 100.0
            contract.l10n_be_group_insurance_amount = insurance_amount
            # Example
            # 5 % salary configurator
            # 4.4 % insurance cost
            # 8.86 % ONSS
            # =-----------------------
            # 13.26 % over the 5%
            contract.l10n_be_group_insurance_cost = insurance_amount * (1 + 13.26 / 100.0)

    def _is_salary_sacrifice(self):
        self.ensure_one()
        return super()._is_salary_sacrifice() or self.l10n_be_group_insurance_rate

    def _get_yearly_cost(self, inverse=False):
        self.ensure_one()
        res = super()._get_yearly_cost(inverse=inverse)
        ratio = (1.0 - self.l10n_be_group_insurance_rate / 100)
        if inverse:
            return res / ratio
        return res * ratio
