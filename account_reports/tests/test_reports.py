# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import time

from odoo.tests import common


class TestAccountReports(common.TransactionCase):
    def setUp(self):
        super(TestAccountReports, self).setUp()
        self.company = self.env.user.company_id

        self.partner_timmy_thomas = self.env['res.partner'].create({
            'name': 'Timmy Thomas',
        })

        #  Account types
        self.account_type_rcv = self.env['account.account.type'].create({
            'name': 'receivable',
            'type': 'receivable',
        })

        self.account_type_liq = self.env['account.account.type'].create({
            'name': 'liquidity',
            'type': 'liquidity',
        })

        self.account_type_other = self.env['account.account.type'].create({
            'name': 'other',
            'type': 'other',
        })

        # Accounts
        self.account_rcv = self.env['account.account'].create({
            'name': 'RCV',
            'code': '001',
            'user_type_id': self.account_type_rcv.id,
            'reconcile': True,
            'company_id': self.company.id,
        })

        self.account_sale = self.env['account.account'].create({
            'name': 'SALE',
            'code': '002',
            'user_type_id': self.account_type_other.id,
            'reconcile': False,
            'company_id': self.company.id,
        })

        self.account_expense = self.env['account.account'].create({
            'name': 'EXP',
            'code': '003',
            'user_type_id': self.account_type_other.id,
            'reconcile': False,
            'company_id': self.company.id,
        })

        self.account_pay = self.env['account.account'].create({
            'name': 'PAY',
            'code': '004',
            'user_type_id': self.account_type_liq.id,
            'reconcile': False,
            'company_id': self.company.id,
        })

        self.account_other = self.env['account.account'].create({
            'name': 'OTHER',
            'code': '005',
            'user_type_id': self.account_type_other.id,
            'reconcile': False,
            'company_id': self.company.id,
        })

        # Journals
        self.payment_journal = self.env['account.journal'].create({
            'name': 'payment',
            'code': 'PAY',
            'type': 'cash',
            'company_id': self.company.id,
            'default_debit_account_id': self.account_pay.id,
            'default_credit_account_id': self.account_pay.id,
        })

        self.sale_journal = self.env['account.journal'].create({
            'name': 'sale',
            'code': 'SALE',
            'type': 'sale',
            'company_id': self.company.id,
            'default_debit_account_id': self.account_sale.id,
            'default_credit_account_id': self.account_sale.id,
        })

        mock_date = time.strftime('%Y') + '-06-26'
        self.minimal_options = {
            'date': {
                'date_from': mock_date,
                'date_to': mock_date,
            },
            'ir_filters': [],
        }
        self.minimal_options_general_ledger = dict(self.minimal_options)
        self.minimal_options_general_ledger['date']['date'] = mock_date
        self.minimal_options_general_ledger.update({
            'unfolded_lines': [],
            'journals': [],
            'comparison': {
                'periods': [],
            }
        })

    def test_00_financial_reports(self):
        for report in self.env['account.financial.html.report'].search([]):
            report.get_html(self.minimal_options)

    def test_01_custom_reports(self):
        report_models = [
            # 'account.bank.reconciliation.report',
            'account.general.ledger',
            'account.generic.tax.report',
        ]
        minimal_context = {
            'state': False,
        }

        for report_model in report_models:
            self.env[report_model].with_context(minimal_context).get_html(self.minimal_options_general_ledger)

    def test_02_followup_reports(self):
        self.minimal_options_general_ledger['partner_id'] = self.env.ref('base.res_partner_2').id
        self.env['account.followup.report'].get_html(self.minimal_options_general_ledger)
