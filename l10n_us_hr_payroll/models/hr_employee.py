# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    l10n_us_old_w4 = fields.Boolean("Filled in 2019 or Before", groups="hr.group_hr_user", tracking=True)
    l10n_us_w4_step_2 = fields.Boolean("Step 2(c): Multiple Jobs or Spouse Works", groups="hr.group_hr_user", tracking=True)
    l10n_us_w4_step_3 = fields.Float("Step 3: Dependents Amount (USD)", groups="hr.group_hr_user", tracking=True)
    l10n_us_w4_step_4a = fields.Float("Step 4(a): Other Income", groups="hr.group_hr_user", tracking=True)
    l10n_us_w4_step_4b = fields.Float("Step 4(b): Deductions", groups="hr.group_hr_user", tracking=True)
    l10n_us_w4_step_4c = fields.Float("Step 4(c): Withholdings", groups="hr.group_hr_user", tracking=True, help="Step 4(c) of the 2020 or later form or line 6 on earlier forms")
    l10n_us_w4_allowances_count = fields.Integer("Number of Claimed Regular Allowances", tracking=True, groups="hr.group_hr_user")
    l10n_us_w4_withholding_deduction_allowances = fields.Integer("Withholding Allowances for estimated deductions", tracking=True, groups="hr.group_hr_user", help="Number of Additional Withholding Allowances for Estimated Deductions claimed on Form W-4 or DE 4.")
    l10n_us_filing_status = fields.Selection([
        ('single', 'Single'),
        ('jointly', 'Married/RDP filing jointly'),
        ('separately', 'Married/RDP filing separately'),
        ('head', 'Head of household'),
        ('survivor', 'Qualifying surviving spouse/RDP with child'),
    ], string="Federal Tax Filing Status", default='single', tracking=True, groups="hr.group_hr_user")
    l10n_us_state_filing_status = fields.Selection([
        ('status_1', 'Single, Dual Income Married or Married with Multiple Employers'),
        ('status_2', 'Married: One Income'),
        ('status_4', 'Unmarried Head of Household'),
    ], string="State Tax Filling Status", tracking=True, groups="hr.group_hr_user")
    l10n_us_statutory_employee = fields.Boolean(
        string="Statutory Employee",
        groups="hr.group_hr_user",
        help="Employees that are exempt from income tax, but subject to FICA Taxes. If checked off it will appear in box 13 of the W2 Report.")
    l10n_us_retirement_plan = fields.Boolean(
        string="Retirement Plan",
        groups="hr.group_hr_user",
        help="""Employee was an "active participant" in an employer-sponsor retirement plan. If checked off it will appear in box 13 of the W2 Report.""")
    l10n_us_third_party_sick_pay = fields.Boolean(
        string="Third-Party Sick Pay",
        groups="hr.group_hr_user",
        help="Employee received third-party sick pay benefits from a third party during the tax year. If checked off it will appear in box 13 of the W2 Report.")

    @api.constrains('ssnid')
    def _check_ssnid(self):
        super()._check_ssnid()
        for employee in self:
            if employee.company_id.country_id.code != "US":
                continue
            if employee.ssnid and (len(employee.ssnid) != 9 or not employee.ssnid.isdigit()):
                raise UserError(_('Social Security number (SSN) should be a nine-digit number.'))
