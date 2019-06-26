# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.http import request


class AccountChartTemplate(models.Model):
    _inherit = "account.chart.template"

    def load_for_current_company(self, sale_tax_rate, purchase_tax_rate):
        """
        Override to configure payroll accounting data as well as accounting data.
        """
        res = super().load_for_current_company(sale_tax_rate, purchase_tax_rate)
        # do not use `request.env` here, it can cause deadlocks
        if request and hasattr(request, 'allowed_company_ids'):
            company = self.env['res.company'].browse(request.allowed_company_ids[0])
        else:
            company = self.env.company
        self._configure_payroll_account_data(company)
        return res

    def _configure_payroll_account_data(self, companies):
        belgian_structures = self.env['hr.payroll.structure'].search([('country_id', '=', self.env.ref('base.be').id)])
        journal_field_id = self.env['ir.model.fields'].search([
            ('model', '=', 'hr.payroll.structure'),
            ('name', '=', 'journal_id')], limit=1)

        for company in companies:
            self = self.with_context({'allowed_company_ids': company.ids})

            journal = self.env['account.journal'].search([
                ('code', '=', 'SLR'),
                ('name', '=', 'Salaries'),
                ('company_id', '=', company.id)])
            if journal:
                account = self.env['account.account'].search([('code', 'like', '620200%')])
                if not journal.default_credit_account_id:
                    journal.default_credit_account_id = account.id
                if not journal.default_debit_account_id:
                    journal.default_debit_account_id = account.id
            else:
                journal = self.env['account.journal'].create({
                    'name': 'Salaries',
                    'code': 'SLR',
                    'type': 'general',
                    'company_id': company.id,
                    'default_credit_account_id': self.env['account.account'].search([('code', 'like', '620200%')]).id,
                    'default_debit_account_id': self.env['account.account'].search([('code', 'like', '620200%')]).id,
                })

                self.env['ir.property'].create([{
                    'name': 'structure_journal_id',
                    'company_id': company.id,
                    'fields_id': journal_field_id.id,
                    'value_reference': 'account.journal,%s' % journal.id,
                    'res_id': 'hr.payroll.structure,%s' % structure.id,
                } for structure in belgian_structures])

            # CP200: Employees 13th Month

            self.env['hr.salary.rule'].search([
                ('struct_id', '=', self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_thirteen_month').id),
                ('code', '=', 'BASIC')
            ]).write({
                'account_credit': self.env['account.account'].search([('code', 'like', '455200%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_thirteen_month_onss_rule').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_thirteen_month_p_p').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '453000%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_thirteen_month_mis_ex_onss').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id
            })

            self.env['hr.salary.rule'].search([
                ('struct_id', '=', self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_thirteen_month').id),
                ('code', '=', 'NET')
            ]).write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id
            })

            # CP200: Employees Double Holidays

            self.env.ref('l10n_be_hr_payroll.cp200_employees_double_holiday_pay_basic').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '455200%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_double_holiday_atn_internet').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '749200%')], limit=1).id,
                'account_debit': self.env['account.account'].search([('code', 'like', '620220%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_double_holiday_atn_mobile').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '749200%')], limit=1).id,
                'account_debit': self.env['account.account'].search([('code', 'like', '620220%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_double_holiday_onss_rule').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_double_holiday_employment_bonus_employees').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_double_holiday_reim_travel').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '623100%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_double_holiday_pay_p_p').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '453000%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_double_holiday_ip_deduction').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '453000%')], limit=1).id,
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id
            })

            self.env['hr.salary.rule'].search([
                ('struct_id', '=', self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_double_holiday').id),
                ('code', '=', 'NET')
            ]).write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id
            })

            # CP200: Employees Monthly Pay

            self.env['hr.salary.rule'].search([
                ('struct_id', '=', self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_salary').id),
                ('code', '=', 'BASIC')
            ]).write({
                'account_credit': self.env['account.account'].search([('code', 'like', '455200%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_atn_internet').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '749200%')], limit=1).id,
                'account_debit': self.env['account.account'].search([('code', 'like', '620220%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_atn_mobile').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '749200%')], limit=1).id,
                'account_debit': self.env['account.account'].search([('code', 'like', '620220%')], limit=1).id
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_onss_rule').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_employment_bonus_employees').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_reim_travel').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '623100%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_company_car').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '749200%')], limit=1).id,
                'account_debit': self.env['account.account'].search([('code', 'like', '620220%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_withholding_taxes').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '453000%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_mis_ex_onss').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_ch_worker').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '749200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_representation_fees').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '455200%')], limit=1).id,
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_ip_deduction').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '453000%')], limit=1).id,
                'account_debit': self.env['account.account'].search([('code', 'like', '620220%')], limit=1).id,
            })

            self.env['hr.salary.rule'].search([
                ('struct_id', '=', self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_salary').id),
                ('code', '=', 'NET')
            ]).write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id
            })

            # CP200: Employees Termination Fees

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_basic_12_92').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '455200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_year_end_bonus').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_residence').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_ch_year').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_eco_checks').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_annual_variable_salary').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_pay_variable_salary').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_benefit_in_kind').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_advantage_any_kind').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '749200%')], limit=1).id,
                'account_debit': self.env['account.account'].search([('code', 'like', '620220%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_company_car_annual').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '749200%')], limit=1).id,
                'account_debit': self.env['account.account'].search([('code', 'like', '620220%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_hospital_insurance').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_group_insurance').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_stock_option').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_specific_CP').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_other_annual').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_annual_salary_revalued').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_notice_duration_month').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_notice_duration_week').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_notice_duration_day').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_termination_total').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_termination_outplacement').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_termination_ONSS').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id,
            })

            # CP200: Employees Termination Holidays N

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n_total_n').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '455200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n_rules_onss_termination').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n_rules_special_contribution_termination').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n_rules_professional_tax_termination').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '453000%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n_pay_net_termination').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })

            # CP200: Employees Termination Holidays N-1

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n1_total_n').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '455200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n1_rules_onss_termination').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id,
            })

            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n1_rules_special_contribution_termination').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '454200%')], limit=1).id,
            })
            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n1_rules_professional_tax_termination').write({
                'account_credit': self.env['account.account'].search([('code', 'like', '453000%')], limit=1).id,
            })
            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n1_pay_net_termination').write({
                'account_debit': self.env['account.account'].search([('code', 'like', '620200%')], limit=1).id,
            })
