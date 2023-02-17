# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class HrContract(models.Model):
    _inherit = 'hr.contract'

    l10n_ke_pension_contribution = fields.Monetary("Pension Contribution")

    l10n_ke_food_allowance = fields.Monetary("Food Allowance")
    l10n_ke_airtime_allowance = fields.Monetary("Airtime Allowance")
    l10n_ke_pension_allowance = fields.Monetary("Pension Allowance")

    l10n_ke_volontary_medical_insurance = fields.Monetary("Voluntary medical Insurance")
    l10n_ke_life_insurance = fields.Monetary("Life Insurance")
    l10n_ke_education = fields.Monetary("Education")

    @api.constrains('l10n_ke_pension_contribution')
    def _check_l10n_ke_pension_contribution(self):
        max_amount = self.env['hr.rule.parameter'].sudo()._get_parameter_from_code('l10n_ke_max_pension_contribution', raise_if_not_found=False)
        for contract in self:
            if max_amount and contract.l10n_ke_pension_contribution > max_amount:
                raise ValidationError(_('The pension contribution cannot exceed %s Ksh!', max_amount))
