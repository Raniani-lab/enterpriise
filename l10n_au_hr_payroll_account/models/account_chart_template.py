# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class AccountChartTemplate(models.AbstractModel):
    _inherit = "account.chart.template"

    def _configure_payroll_account_au(self, companies):
        account_codes = [
            #  Debit
            "62430",  # Wages & Salaries
            "62460",  # Child Support
            "62420",  # Superannuation
            # Credit
            "21300",  # Wages & Salaries
            "21500",  # Child Support
            "21400",  # Superannuation
            "21420",  # PAYG Withholding
        ]
        default_account = "62430"

        # ================================================ #
        #          AU Employee Payroll Structure          #
        # ================================================ #

        structure_schedule_1 = self.env.ref('l10n_au_hr_payroll.hr_payroll_structure_au_regular')
        schedule_1_rule_withholding_net = self.env.ref("l10n_au_hr_payroll.l10n_au_withholding_net_structure_1")
        schedule_1_rule_super = self.env.ref("l10n_au_hr_payroll.l10n_au_super_contribution_structure_1")
        schedule_1_rule_child_support = self.env.ref("l10n_au_hr_payroll.l10n_au_child_support_structure_1")
        schedule_1_rule_net = self.env['hr.salary.rule'].search([
            ('struct_id', '=', structure_schedule_1.id),
            ('code', '=', 'NET')
        ])
        #  Schedule 2
        schedule_2_rule_withholding = self.env.ref("l10n_au_hr_payroll.l10n_au_withholding_structure_2")
        schedule_2_rule_net = self.env.ref("l10n_au_hr_payroll.l10n_au_withholding_net_structure_2")
        schedule_2_rule_super = self.env.ref("l10n_au_hr_payroll.l10n_au_super_contribution_structure_2")
        schedule_2_rule_child_support = self.env.ref("l10n_au_hr_payroll.l10n_au_child_support_structure_2")
        #  Schedule 3
        schedule_3_rule_withholding = self.env.ref("l10n_au_hr_payroll.l10n_au_withholding_actors_structure_3")
        schedule_3_rule_net = self.env.ref("l10n_au_hr_payroll.l10n_au_withholding_net_structure_3")
        schedule_3_rule_super = self.env.ref("l10n_au_hr_payroll.l10n_au_super_contribution_structure_3")
        schedule_3_rule_child_support = self.env.ref("l10n_au_hr_payroll.l10n_au_child_support_structure_3")
        schedule_3_rule_promo_withholding = self.env.ref("l10n_au_hr_payroll.l10n_au_withholding_actors_structure_3_promo")
        schedule_3_rule_child_support_promo = self.env.ref("l10n_au_hr_payroll.l10n_au_child_support_structure_3_promo")
        #  Schedule 4
        structure_schedule_4 = self.env.ref('l10n_au_hr_payroll.hr_payroll_structure_au_return_to_work')
        schedule_4_rule_withholding = self.env.ref("l10n_au_hr_payroll.l10n_au_withholding_return_to_work_structure_4")
        schedule_4_rule_child_support = self.env.ref("l10n_au_hr_payroll.l10n_au_child_support_return_to_work_structure_4")
        schedule_4_rule_net = self.env['hr.salary.rule'].search([
            ('struct_id', '=', structure_schedule_4.id),
            ('code', '=', 'NET')
        ])
        #  Schedule 5
        structure_schedule_5 = self.env.ref('l10n_au_hr_payroll.hr_payroll_structure_au_lumpsum')
        schedule_5_rule_withholding = self.env.ref("l10n_au_hr_payroll.l10n_au_withholding_lumpsum_structure_5")
        schedule_5_rule_net = self.env['hr.salary.rule'].search([
            ('struct_id', '=', structure_schedule_5.id),
            ('code', '=', 'NET')
        ])
        #  Schedule 7 / 11
        schedule_7_11_rule_withholding = self.env.ref("l10n_au_hr_payroll.l10n_au_termination_withholding")
        schedule_7_11_rule_net = self.env.ref("l10n_au_hr_payroll.l10n_au_termination_net_salary")
        schedule_7_11_rule_child_support = self.env.ref("l10n_au_hr_payroll.l10n_au_termination_child_support")
        #  Schedule 15
        structure_schedule_15 = self.env.ref('l10n_au_hr_payroll.hr_payroll_structure_au_whm')
        schedule_15_rule_withholding = self.env.ref("l10n_au_hr_payroll.l10n_au_withholding_whm_structure_15")
        schedule_15_rule_net = self.env['hr.salary.rule'].search([
            ('struct_id', '=', structure_schedule_15.id),
            ('code', '=', 'NET')
        ])
        #  No TFN
        structure_no_tfn = self.env.ref('l10n_au_hr_payroll.hr_payroll_structure_au_no_tfn')
        no_tfn_rule_withholding = self.env.ref("l10n_au_hr_payroll.l10n_au_withholding_net_no_tfn")
        no_tfn_rule_net = self.env['hr.salary.rule'].search([
            ('struct_id', '=', structure_no_tfn.id),
            ('code', '=', 'NET')
        ])

        rules_mapping = {
            # Schedule 1
            schedule_1_rule_withholding_net: {
                "credit": "21420",
                "debit": "62430",
            },
            schedule_1_rule_net: {
                "credit": "21300",
                "debit": "62430",
            },
            schedule_1_rule_super: {
                "credit": "21400",
                "debit": "62420",
            },
            schedule_1_rule_child_support: {
                "credit": "21500",
                "debit": "62460",
            },
            #  Schedule 2
            schedule_2_rule_withholding: {
                "credit": "21420",
                "debit": "62430",
            },
            schedule_2_rule_net: {
                "credit": "21300",
                "debit": "62430",
            },
            schedule_2_rule_super: {
                "credit": "21400",
                "debit": "62420",
            },
            schedule_2_rule_child_support: {
                "credit": "21500",
                "debit": "62460",
            },
            # Schedule 3
            schedule_3_rule_withholding: {
                "credit": "21420",
                "debit": "62430",
            },
            schedule_3_rule_net: {
                "credit": "21300",
                "debit": "62430",
            },
            schedule_3_rule_super: {
                "credit": "21400",
                "debit": "62420",
            },
            schedule_3_rule_child_support: {
                "credit": "21500",
                "debit": "62460",
            },
            # Shedule 3 - Promo
            schedule_3_rule_promo_withholding: {
                "credit": "21420",
                "debit": "62430",
            },
            schedule_3_rule_child_support_promo: {
                "credit": "21500",
                "debit": "62460",
            },
            # Schedule 4
            schedule_4_rule_withholding: {
                "credit": "21420",
                "debit": "62430",
            },
            schedule_4_rule_net: {
                "credit": "21300",
                "debit": "62430",
            },
            schedule_4_rule_child_support: {
                "credit": "21500",
                "debit": "62460",
            },
            # Schedule 5
            schedule_5_rule_withholding: {
                "credit": "21420",
                "debit": "62430",
            },
            schedule_5_rule_net: {
                "credit": "21300",
                "debit": "62430",
            },
            # Schedule 7 / 11
            schedule_7_11_rule_withholding: {
                "credit": "21420",
                "debit": "62430",
            },
            schedule_7_11_rule_net: {
                "credit": "21300",
                "debit": "62430",
            },
            schedule_7_11_rule_child_support: {
                "credit": "21500",
                "debit": "62460",
            },
            # Schedule 15
            schedule_15_rule_withholding: {
                "credit": "21420",
                "debit": "62430",
            },
            schedule_15_rule_net: {
                "credit": "21300",
                "debit": "62430",
            },
            # No TFN
            no_tfn_rule_withholding: {
                "credit": "21420",
                "debit": "62430",
            },
            no_tfn_rule_net: {
                "credit": "21300",
                "debit": "62430",
            },
        }

        self._configure_payroll_account(
            companies,
            "AU",
            account_codes=account_codes,
            rules_mapping=rules_mapping,
            default_account=default_account)
