# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.exceptions import ValidationError

from odoo import models, _


class AccountChartTemplate(models.AbstractModel):
    _inherit = "account.chart.template"

    def _load_payroll_accounts(self, template_code, companies):
        if template_code != 'pl':
            return super()._load_payroll_accounts(template_code, companies)
        return self._configure_payroll_account_poland(companies)

    def _configure_payroll_account_poland(self, companies):
        accounts_codes = [
            # YTI TODO: Configure accounts
        ]
        lt_structures = self.env['hr.payroll.structure'].search([('country_id.code', '=', "PL")])
        if not companies or not lt_structures:
            return
        for company in companies:
            self = self.with_company(company)

            accounts = {}
            for code in accounts_codes:
                account = self.env['account.account'].search(
                    [('company_id', '=', company.id), ('code', 'like', '%s%%' % code)], limit=1)
                if not account:
                    raise ValidationError(_('No existing account for code %s', code))
                accounts[code] = account

            journal = self.env['account.journal'].search([
                ('code', '=', 'SLR'),
                ('name', '=', 'Salaries'),
                ('company_id', '=', company.id)])

            if not journal:
                journal = self.env['account.journal'].create({
                    'name': 'Salaries',
                    'code': 'SLR',
                    'type': 'general',
                    'company_id': company.id,
                })

            self.env['ir.property']._set_multi(
                "journal_id",
                "hr.payroll.structure",
                {structure.id: journal.id for structure in lt_structures},
            )

            # ================================================ #
            #           PL Employee Payroll Structure          #
            # ================================================ #

            # TODO: Setup Accounts
