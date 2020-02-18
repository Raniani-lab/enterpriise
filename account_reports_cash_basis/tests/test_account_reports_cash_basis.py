# -*- coding: utf-8 -*-
from odoo.tests import tagged
from odoo.tools import date_utils

from odoo.addons.account_reports.tests.common import TestAccountReportsCommon


@tagged('post_install', '-at_install')
class TestAccountReports(TestAccountReportsCommon):
    def test_general_ledger_cash_basis(self):
        ''' Test folded/unfolded lines with the cash basis option. '''
        # Check the cash basis option.
        report = self.env['account.general.ledger']
        options = self._init_options(report, *date_utils.get_month(self.mar_year_minus_1))
        options['cash_basis'] = True
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Debit           Credit          Balance
            [   0,                                      4,              5,              6],
            [
                # Accounts.
                ('101401 Bank',                          200.00,        1250.00,     -1050.00),
                ('101402 Outstanding Receipts',          800.00,         100.00,      700.00),
                ('101403 Outstanding Payments',         1250.00,        1750.00,     -500.00),
                ('101702 Bank Suspense Account',           0.00,         100.00,     -100.00),
                ('121000 Account Receivable',            800.00,         800.00,        0.00),
                ('131000 Tax Paid',                      228.26,           0.00,      228.26),
                ('211000 Account Payable',              1750.00,        1750.00,        0.00),
                ('251000 Tax Received',                    0.00,         104.34,     -104.34),
                ('400000 Product Sales',                   0.00,         695.66,     -695.66),
                ('600000 Expenses',                      478.26,           0.00,      478.26),
                ('999999 Undistributed Profits/Losses', 1043.48,           0.00,     1043.48),
                # Report Total.
                ('Total',                               6550.00,        6550.00,        0.00),
            ],
        )

        # Mark the '101200 Account Receivable' line to be unfolded.
        line_id = lines[4]['id']
        options['unfolded_lines'] = [line_id]
        options['cash_basis'] = False  # Because we are in the same transaction, the table temp_account_move_line still exists
        report = report.with_context(report._set_context(options))
        lines = report._get_lines(options, line_id=line_id)

        self.assertLinesValues(
            lines,
            #   Name                                    Date            Partner         Debit           Credit          Balance
            [   0,                                      1,              3,              4,              5,              6],
            [
                # Account.
                ('121000 Account Receivable',           '',             '',             800.00,         800.00,         0.00),
                # Initial Balance.
                ('Initial Balance',                     '',             '',             700.00,         700.00,         0.00),
                # Account Move Lines.
                ('INV/2017/02/0002',                    '03/01/2017',   'partner_c',    100.00,             '',       100.00),
                ('BNK1/2017/03/0001',                   '03/01/2017',   'partner_c',        '',         100.00,         0.00),
                # Account Total.
                ('Total 121000 Account Receivable',     '',             '',             800.00,         800.00,         0.00),
            ],
        )

    def test_trial_balance_cash_basis(self):
        ''' Test the cash basis option. '''
        # Check the cash basis option.
        report = self.env['account.coa.report']
        options = self._init_options(report, *date_utils.get_month(self.mar_year_minus_1))
        options['cash_basis'] = True
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #                                           [  Initial Balance   ]          [   Month Balance    ]          [       Total        ]
            #   Name                                    Debit           Credit          Debit           Credit          Debit           Credit
            [   0,                                      1,              2,              3,              4,              5,              6],
            [
                # Accounts.
                ('101401 Bank',                         '',             1150.00,        100.00,         '',             '',             1050.00),
                ('101402 Outstanding Receipts',         600.00,         '',             100.00,         '',             700.00,         ''),
                ('101403 Outstanding Payments',         '',             200.00,         '',             300.00,         '',             500.00),
                ('101702 Bank Suspense Account',        '',             '',             '',             100.00,         '',             100.00),
                ('121000 Account Receivable',           '',             '',             100.00,         100.00,         '',             ''),
                ('131000 Tax Paid',                     189.13,         '',             39.13,          '',             228.26,         ''),
                ('211000 Account Payable',              '',             '',             300.00,         300.00,         '',             ''),
                ('251000 Tax Received',                 '',             91.30,          '',             13.04,          '',             104.34),
                ('400000 Product Sales',                '',             608.70,         '',             86.96,          '',             695.66),
                ('600000 Expenses',                     217.39,         '',             260.87,         '',             478.26,         ''),
                ('999999 Undistributed Profits/Losses', 1043.48,        '',             '',             '',             1043.48,        ''),
                # Report Total.
                ('Total',                               2050.00,        2050.00,        900.00,         900.00,         2450.00,        2450.00),
            ],
        )

    def test_balance_sheet_cash_basis(self):
        ''' Test folded/unfolded lines with the cash basis option. '''
        # Check the cash basis option.
        report = self.env.ref('account_reports.account_financial_report_balancesheet0')._with_correct_filters()
        options = self._init_options(report, *date_utils.get_month(self.mar_year_minus_1))
        options['cash_basis'] = True
        report = report.with_context(report._set_context(options))

        lines = report._get_table(options)[1]
        self.assertLinesValues(
            lines,
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('ASSETS',                                      -721.74),
                ('Current Assets',                              -721.74),
                ('Bank and Cash Accounts',                      -1050.00),
                ('Receivables',                                 0.00),
                ('Current Assets',                              328.26),
                ('Prepayments',                                 0.00),
                ('Total Current Assets',                        -721.74),
                ('Plus Fixed Assets',                           0.00),
                ('Plus Non-current Assets',                     0.00),
                ('Total ASSETS',                                -721.74),

                ('LIABILITIES',                                 104.34),
                ('Current Liabilities',                         104.34),
                ('Current Liabilities',                         104.34),
                ('Payables',                                    0.00),
                ('Total Current Liabilities',                   104.34),
                ('Plus Non-current Liabilities',                0.00),
                ('Total LIABILITIES',                           104.34),

                ('EQUITY',                                      -826.08),
                ('Unallocated Earnings',                        -826.08),
                ('Current Year Unallocated Earnings',           217.40),
                ('Current Year Earnings',                       217.40),
                ('Current Year Allocated Earnings',             0.00),
                ('Total Current Year Unallocated Earnings',     217.40),
                ('Previous Years Unallocated Earnings',         -1043.48),
                ('Total Unallocated Earnings',                  -826.08),
                ('Retained Earnings',                           0.00),
                ('Total EQUITY',                                -826.08),

                ('LIABILITIES + EQUITY',                        -721.74),
            ],
        )
