# coding: utf-8
from odoo import api, fields, models, _
from odoo.tools import date_utils


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    def load_for_current_company(self, sale_tax_rate, purchase_tax_rate):
        res = super(AccountChartTemplate, self).load_for_current_company(sale_tax_rate, purchase_tax_rate)

        # by default, anglo-saxon companies should have totals
        # displayed below sections in their reports
        company = self.env.user.company_id
        company.totals_below_sections = company.anglo_saxon_accounting

        #set a default misc journal for the tax closure
        company.tax_periodicity_journal_id = company._get_default_misc_journal()

        company.tax_periodicity_next_deadline = date_utils.end_of(fields.Date.today(), "month")
        # create the recurring entry
        vals = {
            'company_id': company,
            'tax_periodicity': company.tax_periodicity,
            'tax_periodicity_journal_id': company.tax_periodicity_journal_id,
            'tax_periodicity_next_deadline': company.tax_periodicity_next_deadline,
        }
        self.env['res.config.settings']._create_edit_tax_reminder(vals)
        return res
