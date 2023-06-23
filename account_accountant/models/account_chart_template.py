# -*- coding: utf-8 -*-
from odoo import models


class AccountChartTemplate(models.AbstractModel):
    _inherit = 'account.chart.template'

    def _post_load_data(self, template_code, company, template_data):
        super()._post_load_data(template_code, company, template_data)
        company = company or self.env.company
        if not company.deferred_journal_id:
            company.deferred_journal_id = self.env['account.journal'].search([
                *self.env['account.journal']._check_company_domain(company),
                ('type', '=', 'general')
            ], limit=1)
        if not company.deferred_expense_account_id:
            company.deferred_expense_account_id = self.env['account.account'].search([
                *self.env['account.account']._check_company_domain(company),
                ('account_type', '=', 'asset_current')
            ], limit=1)
        if not company.deferred_revenue_account_id:
            company.deferred_revenue_account_id = self.env['account.account'].search([
                *self.env['account.account']._check_company_domain(company),
                ('account_type', '=', 'liability_current')
            ], limit=1)
