# -*- coding: utf-8 -*-
from odoo import fields
from odoo.tests import tagged
from odoo.tests.common import Form
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT, date_utils
from unittest.mock import patch
import datetime
import logging

from odoo.addons.account_reports.tests.common import TestAccountReportsCommon

_logger = logging.getLogger(__name__)


@tagged('post_install', '-at_install')
class TestAccountReports(TestAccountReportsCommon):

    # -------------------------------------------------------------------------
    # TESTS: Multicurrency Revaluation Report
    # -------------------------------------------------------------------------
    def test_multi_currency_revaluation_report(self):
        report = self.env['account.multicurrency.revaluation.report']

        self.eur_to_usd.name = '2015-01-10'
        # 1 USD = 2.0 EUR at this date
        # 1 USD = 1.0 EUR before this date

        # Create invoice and payment in foreign currency
        self_eur = report.with_context(default_currency_id=self.env.ref('base.EUR').id)
        invoice = self._create_invoice(self_eur.env, 1000, self.partner_a, 'out_invoice', '2015-01-01')
        self._create_payment(self_eur.env, fields.Date.from_string('2015-01-15'), invoice, amount=1035)

        # Create invoice and payment in company currency. These should not appear in the report.
        self_usd = report.with_context(default_currency_id=self.env.ref('base.USD').id)
        invoice = self._create_invoice(self_usd.env, 1000, self.partner_a, 'out_invoice', '2015-01-01')
        self._create_payment(self_usd.env, fields.Date.from_string('2015-01-15'), invoice, amount=1035)

        # Check values before payment and before rate change
        options = self._init_options(report, fields.Date.from_string('2015-01-01'), fields.Date.from_string('2015-01-01'))
        self.assertLinesValues(report._get_lines(options),
            [     0,                                     1,            2,            3,           4],
            [
                ('Accounts to adjust',                  '',           '',           '',          ''),
                ('EUR (1 USD = 1.0 EUR)',     '1,150.00 €', '$ 1,150.00', '$ 1,150.00',    '$ 0.00'),
                ('121000 Account Receivable', '1,150.00 €', '$ 1,150.00', '$ 1,150.00',    '$ 0.00'),
            ],
        )

        # Check values before payment and after rate change
        options = self._init_options(report, fields.Date.from_string('2015-01-10'), fields.Date.from_string('2015-01-10'))
        self.assertLinesValues(report._get_lines(options),
            [     0,                                     1,            2,            3,           4],
            [
                ('Accounts to adjust',                  '',           '',           '',          ''),
                ('EUR (1 USD = 2.0 EUR)',     '1,150.00 €', '$ 1,150.00',   '$ 575.00', '$ -575.00'),
                ('121000 Account Receivable', '1,150.00 €', '$ 1,150.00',   '$ 575.00', '$ -575.00'),
            ],
        )

        # Check values after payment and after rate change
        options = self._init_options(report, fields.Date.from_string('2015-01-31'), fields.Date.from_string('2015-01-31'))
        self.assertLinesValues(report._get_lines(options),
            [     0,                                     1,            2,            3,           4],
            [
                ('Accounts to adjust',                  '',           '',           '',          ''),
                ('EUR (1 USD = 2.0 EUR)',       '115.00 €',   '$ 632.50',    '$ 57.50', '$ -575.00'),
                ('121000 Account Receivable',   '115.00 €',   '$ 632.50',    '$ 57.50', '$ -575.00'),
            ],
        )
    # -------------------------------------------------------------------------
    # TESTS: Reconciliation Report
    # -------------------------------------------------------------------------

    def test_reconciliation_report_single_currency(self):
        ''' Tests the impact of positive/negative payments/statements on the reconciliation report in a single-currency
        environment.
        '''

        bank_journal = self.env['account.journal'].create({
            'name': 'Bank',
            'code': 'BNKKK',
            'type': 'bank',
            'company_id': self.company_parent.id,
        })

        # ==== Statements ====

        statement_1 = self.env['account.bank.statement'].create({
            'name': 'statement_1',
            'date': '2014-12-31',
            'balance_start': 0.0,
            'balance_end_real': 100.0,
            'journal_id': bank_journal.id,
            'line_ids': [
                (0, 0, {'payment_ref': 'line_1',    'amount': 600.0,    'date': '2014-12-31'}),
                (0, 0, {'payment_ref': 'line_2',    'amount': -500.0,   'date': '2014-12-31'}),
            ],
        })

        statement_2 = self.env['account.bank.statement'].create({
            'name': 'statement_2',
            'date': '2015-01-05',
            'balance_start': 200.0, # create an unexplained difference of 100.0.
            'balance_end_real': -200.0,
            'journal_id': bank_journal.id,
            'line_ids': [
                (0, 0, {'payment_ref': 'line_1',    'amount': 100.0,    'date': '2015-01-01',   'partner_id': self.partner_a.id}),
                (0, 0, {'payment_ref': 'line_2',    'amount': 200.0,    'date': '2015-01-02'}),
                (0, 0, {'payment_ref': 'line_3',    'amount': -300.0,   'date': '2015-01-03',   'partner_id': self.partner_a.id}),
                (0, 0, {'payment_ref': 'line_4',    'amount': -400.0,   'date': '2015-01-04'}),
            ],
        })

        (statement_1 + statement_2).button_post()

        # ==== Payments ====

        payment_1 = self.env['account.payment'].create({
            'amount': 150.0,
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'date': '2015-01-01',
            'journal_id': bank_journal.id,
            'partner_id': self.partner_a.id,
            'payment_method_id': self.env.ref('account.account_payment_method_manual_in').id,
        })

        payment_2 = self.env['account.payment'].create({
            'amount': 250.0,
            'payment_type': 'outbound',
            'partner_type': 'supplier',
            'date': '2015-01-02',
            'journal_id': bank_journal.id,
            'partner_id': self.partner_a.id,
            'payment_method_id': self.env.ref('account.account_payment_method_manual_out').id,
        })

        payment_3 = self.env['account.payment'].create({
            'amount': 350.0,
            'payment_type': 'outbound',
            'partner_type': 'customer',
            'date': '2015-01-03',
            'journal_id': bank_journal.id,
            'partner_id': self.partner_a.id,
            'payment_method_id': self.env.ref('account.account_payment_method_manual_in').id,
        })

        payment_4 = self.env['account.payment'].create({
            'amount': 450.0,
            'payment_type': 'inbound',
            'partner_type': 'supplier',
            'date': '2015-01-04',
            'journal_id': bank_journal.id,
            'partner_id': self.partner_a.id,
            'payment_method_id': self.env.ref('account.account_payment_method_manual_out').id,
        })

        (payment_1 + payment_2 + payment_3 + payment_4).action_post()

        # ==== Reconciliation ====
        self.partner_a.property_account_receivable_id = self.env['account.account'].search([
            ('company_id', '=', self.company_parent.id), ('user_type_id.type', '=', 'receivable')
        ], limit=1)
        self.partner_a.property_account_payable_id = self.env['account.account'].search([
            ('company_id', '=', self.company_parent.id), ('user_type_id.type', '=', 'payable')
        ], limit=1)

        st_line = statement_2.line_ids.filtered(lambda line: line.payment_ref == 'line_1')
        payment_line = payment_1.line_ids.filtered(lambda line: line.account_id == bank_journal.payment_debit_account_id)
        st_line.reconcile([{'id': payment_line.id}])

        st_line = statement_2.line_ids.filtered(lambda line: line.payment_ref == 'line_3')
        payment_line = payment_2.line_ids.filtered(lambda line: line.account_id == bank_journal.payment_credit_account_id)
        st_line.reconcile([{'id': payment_line.id}])

        # ==== Report ====

        with self.mocked_today('2016-01-02'):

            report = self.env['account.bank.reconciliation.report'].with_context(active_id=bank_journal.id)
            options = report._get_options(None)

            self.assertLinesValues(
                report._get_lines(options),
                #   Name                                                            Date            Amount
                [   0,                                                              1,              3],
                [
                    ('Balance of 101404 Bank',                                      '01/02/2016',   -300.0),

                    ('Including Unreconciled Bank Statement Receipts',              '',             800.0),
                    ('BNKKK/2015/01/0002',                                          '01/02/2015',   200.0),
                    ('BNKKK/2014/12/0001',                                          '12/31/2014',   600.0),
                    ('Total Including Unreconciled Bank Statement Receipts',        '',             800.0),

                    ('Including Unreconciled Bank Statement Payments',              '',             -900.0),
                    ('BNKKK/2015/01/0004',                                          '01/04/2015',   -400.0),
                    ('BNKKK/2014/12/0002',                                          '12/31/2014',   -500.0),
                    ('Total Including Unreconciled Bank Statement Payments',        '',             -900.0),

                    ('Total Balance of 101404 Bank',                                '01/02/2016',   -300.0),

                    ('Outstanding Payments/Receipts',                               '',             100.0),

                    ('(+) Outstanding Receipts',                                    '',             450.0),
                    ('BNKKK/2015/01/0008',                                          '01/04/2015',   450.0),
                    ('Total (+) Outstanding Receipts',                              '',             450.0),

                    ('(-) Outstanding Payments',                                    '',             -350.0),
                    ('BNKKK/2015/01/0007',                                          '01/03/2015',   -350.0),
                    ('Total (-) Outstanding Payments',                              '',             -350.0),

                    ('Total Outstanding Payments/Receipts',                         '',             100.0),
                ],
                currency_map={3: {'currency': bank_journal.currency_id}},
            )

    def test_reconciliation_report_multi_currencies(self):
        ''' Tests the management of multi-currencies in the reconciliation report. '''
        self.env.user.groups_id |= self.env.ref('base.group_multi_currency')

        foreign_currency_1 = self.company_child_eur.currency_id

        foreign_currency_2 = self.env['res.currency'].create({
            'name': 'Dark Chocolate Coin',
            'symbol': '🍫',
            'currency_unit_label': 'Dark Choco',
            'currency_subunit_label': 'Dark Cacao Powder',
        })

        self.env['res.currency.rate'].create({
            'name': '2016-01-01',
            'rate': 10.0,
            'currency_id': foreign_currency_2.id,
            'company_id': self.company_parent.id,
        })

        # ==== Journal with a foreign currency ====

        bank_journal = self.env['account.journal'].create({
            'name': 'Bank',
            'code': 'BNKKK',
            'type': 'bank',
            'company_id': self.company_parent.id,
            'currency_id': foreign_currency_1.id
        })

        # ==== Statement ====

        statement = self.env['account.bank.statement'].create({
            'name': 'statement',
            'date': '2016-01-01',
            'journal_id': bank_journal.id,
            'line_ids': [

                # Transaction in the company currency.
                (0, 0, {
                    'payment_ref': 'line_1',
                    'amount': 100.0,
                    'amount_currency': 50.01,
                    'foreign_currency_id': self.company_parent.currency_id.id,
                }),

                # Transaction in a third currency.
                (0, 0, {
                    'payment_ref': 'line_3',
                    'amount': 100.0,
                    'amount_currency': 999.99,
                    'foreign_currency_id': foreign_currency_2.id,
                }),

            ],
        })
        statement.button_post()

        # ==== Payments ====

        # Payment in the company's currency.
        payment_1 = self.env['account.payment'].create({
            'amount': 1000.0,
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'date': '2016-01-01',
            'journal_id': bank_journal.id,
            'partner_id': self.partner_a.id,
            'currency_id': self.company_parent.currency_id.id,
            'payment_method_id': self.env.ref('account.account_payment_method_manual_in').id,
        })
        payment_1.action_post()

        # Payment in the same foreign currency as the journal.
        payment_2 = self.env['account.payment'].create({
            'amount': 2000.0,
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'date': '2016-01-01',
            'journal_id': bank_journal.id,
            'partner_id': self.partner_a.id,
            'currency_id': foreign_currency_1.id,
            'payment_method_id': self.env.ref('account.account_payment_method_manual_in').id,
        })
        payment_2.action_post()

        # Payment in a third foreign currency.
        payment_3 = self.env['account.payment'].create({
            'amount': 3000.0,
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'date': '2016-01-01',
            'journal_id': bank_journal.id,
            'partner_id': self.partner_a.id,
            'currency_id': foreign_currency_2.id,
            'payment_method_id': self.env.ref('account.account_payment_method_manual_in').id,
        })
        payment_3.action_post()

        # ==== Report ====

        report = self.env['account.bank.reconciliation.report'].with_context(active_id=bank_journal.id)

        with self.mocked_today('2016-01-02'), self.debug_mode(report):

            options = report._get_options(None)
            lines = report._get_lines(options)

            choco_code = foreign_currency_2.name
            comp_code = self.company_parent.currency_id.name
            self.assertLinesValues(
                lines,
                #   Name                                                            Date            Amount  Currency    Amount
                [   0,                                                              1,              3,      4,          5],
                [
                    ('Balance of 101404 Bank',                                      '01/02/2016',   '',     '',         200.0),

                    ('Including Unreconciled Bank Statement Receipts',              '',             '',     '',         200.0),
                    ('BNKKK/2016/01/0002',                                          '01/01/2016',   999.99, choco_code, 100.0),
                    ('BNKKK/2016/01/0001',                                          '01/01/2016',   50.01,  comp_code,  100.0),
                    ('Total Including Unreconciled Bank Statement Receipts',        '',             '',     '',         200.0),

                    ('Total Balance of 101404 Bank',                                '01/02/2016',   '',     '',         200.0),

                    ('Outstanding Payments/Receipts',                               '',             '',     '',         4600.0),

                    ('(+) Outstanding Receipts',                                    '',             '',     '',         4600.0),
                    ('BNKKK/2016/01/0005',                                          '01/01/2016',   3000.0, choco_code, 600.0),
                    ('BNKKK/2016/01/0004',                                          '01/01/2016',   '',     '',         2000.0),
                    ('BNKKK/2016/01/0003',                                          '01/01/2016',   1000.0, comp_code,  2000.0),
                    ('Total (+) Outstanding Receipts',                              '',             '',     '',         4600.0),

                    ('Total Outstanding Payments/Receipts',                         '',             '',     '',         4600.0),
                ],
                currency_map={
                    3: {'currency_code_index': 4},
                    5: {'currency': bank_journal.currency_id},
                },
            )
