# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _
from odoo.exceptions import ValidationError


class AccountChartTemplate(models.AbstractModel):
    _inherit = "account.chart.template"

    def _post_load_data(self, template_code, company, template_data):
        super()._post_load_data(template_code, company, template_data)
        self._load_payroll_accounts(template_code, company)

    def _load_payroll_accounts(self, template_code, companies):
        config_method = getattr(self, f'_configure_payroll_account_{template_code}', None)
        if config_method:
            config_method(companies)

    @api.model
    def _configure_payroll_account(self, companies, country_code, account_codes=None, rules_mapping=None, default_account=None):
        # companies: Recordset of the companies to configure
        # country_code: list containing all the needed accounts code
        # rule_mapping: dictionary of the debit/credit accounts for each related rule
        # default_account: Defaut account to specify on the created journals
        structures = self.env['hr.payroll.structure'].search([('country_id.code', '=', country_code)])
        AccountAccount = self.env['account.account']
        if not companies or not structures:
            return
        for company in companies:
            self = self.with_company(company)

            accounts = {}
            for code in account_codes:
                account = AccountAccount.search([
                    ('company_id', '=', company.id),
                    ('code', '=like', '%s%%' % code)], limit=1)
                if not account:
                    raise ValidationError(_('No existing account for code %s', code))
                accounts[code] = account

            journal = self.env['account.journal'].search([
                ('code', '=', 'SLR'),
                ('name', '=', 'Salaries'),
                ('company_id', '=', company.id)])

            if journal:
                if not journal.default_account_id and default_account:
                    journal.default_account_id = accounts[default_account].id
            else:
                journal = self.env['account.journal'].create({
                    'name': 'Salaries',
                    'code': 'SLR',
                    'type': 'general',
                    'company_id': company.id,
                    'default_account_id': accounts.get(default_account, AccountAccount).id,
                })

                self.env['ir.property']._set_multi(
                    "journal_id",
                    "hr.payroll.structure",
                    {structure.id: journal for structure in structures},
                )

            for rule, rule_mapping in rules_mapping.items():
                vals = {}
                if 'credit' in rule_mapping:
                    vals['account_credit'] = accounts.get(rule_mapping['credit'], AccountAccount).id
                if 'debit' in rule_mapping:
                    vals['account_debit'] = accounts.get(rule_mapping['debit'], AccountAccount).id
                if vals:
                    rule.write(vals)
