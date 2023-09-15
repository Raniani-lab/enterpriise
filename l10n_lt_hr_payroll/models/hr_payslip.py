# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class HrEmployee(models.Model):
    _inherit = 'hr.payslip'

    def _get_data_files_to_update(self):
        # Note: file order should be maintained
        return super()._get_data_files_to_update() + [(
            'l10n_lt_hr_payroll', [
                'data/hr_salary_rule_category_data.xml',
                'data/hr_payroll_structure_type_data.xml',
                'data/hr_payroll_structure_data.xml',
                'data/hr_rule_parameters_data.xml',
                'data/hr_salary_rule_data.xml',
            ])]

    def _get_base_local_dict(self):
        res = super()._get_base_local_dict()
        res.update({
            'get_l10n_lt_taxable_amount': get_l10n_lt_taxable_amount,
        })
        return res

def get_l10n_lt_taxable_amount(payslip, categories, worked_days, inputs, sick=False):
    taxable_amount = categories['GROSS']
    if not payslip.employee_id.is_non_resident:
        low = payslip._rule_parameter('l10n_lt_tax_exempt_low')
        high = payslip._rule_parameter('l10n_lt_tax_exempt_high')
        basic = payslip._rule_parameter('l10n_lt_tax_exempt_basic')
        rate = payslip._rule_parameter('l10n_lt_tax_exempt_rate')
        if taxable_amount <= low:
            taxable_amount -= basic
        elif taxable_amount <= high:
            taxable_amount -= basic - rate * (taxable_amount - low)

        if payslip.employee_id.l10n_lt_working_capacity == "0_25":
            taxable_amount -= payslip._rule_parameter('l10n_lt_tax_exempt_0_25')
        elif payslip.employee_id.l10n_lt_working_capacity == "30_55":
            taxable_amount -= payslip._rule_parameter('l10n_lt_tax_exempt_30_55')
    sick_amount = sum(payslip.worked_days_line_ids.filtered(lambda wd: wd.code == 'LEAVE110').mapped('amount'))
    if sick:
        return min(taxable_amount, sick_amount)
    return max(taxable_amount - sick_amount, 0)
