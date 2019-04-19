# coding: utf-8
from odoo import models


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    def load_for_current_company(self, sale_tax_rate, purchase_tax_rate):
        res = super(AccountChartTemplate, self).load_for_current_company(sale_tax_rate, purchase_tax_rate)

        # by default, anglo-saxon companies should have totals
        # displayed below sections in their reports
        company = self.env.user.company_id
        company.totals_below_sections = company.anglo_saxon_accounting

        #set a default misc journal for the tax closure
        company.account_tax_periodicity_journal_id = company._get_default_misc_journal()

        company.account_tax_periodicity_reminder_day = 7
        # create the recurring entry
        vals = {
            'company_id': company,
            'account_tax_periodicity': company.account_tax_periodicity,
            'account_tax_periodicity_journal_id': company.account_tax_periodicity_journal_id,
        }
        self.env['res.config.settings']._create_edit_tax_reminder(vals)
        company.account_tax_original_periodicity_reminder_day = company.account_tax_periodicity_reminder_day
        return res
