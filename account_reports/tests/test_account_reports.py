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
    # TESTS: All generic financial report features
    # -------------------------------------------------------------------------

    def test_financial_html_report_1(self):
        # Init options.
        report = self.env.ref('account_reports.account_financial_report_balancesheet0')
        report.applicable_filters_ids = [(6, 0, (self.ir_filters_partner_a + self.ir_filters_groupby_partner_id_company_id).ids)]
        report = report._with_correct_filters()
        options = self._init_options(report, *date_utils.get_month(self.mar_year_minus_1))

        # ===================================================================================================
        # Check initial report without the 'totals_below_sections'.
        # ===================================================================================================

        self.company_parent.totals_below_sections = False
        lines = report._get_table(options)[1]
        self.assertLinesValues(
            lines,
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('ASSETS',                                      1830.00),
                ('Current Assets',                              1830.00),
                ('Bank and Cash Accounts',                      -1050.00),
                ('Receivables',                                 2075.00),
                ('Current Assets',                              805.00),
                ('Prepayments',                                 0.00),
                ('Plus Fixed Assets',                           0.00),
                ('Plus Non-current Assets',                     0.00),

                ('LIABILITIES',                                 4030.00),
                ('Current Liabilities',                         4030.00),
                ('Current Liabilities',                         375.00),
                ('Payables',                                    3655.00),
                ('Plus Non-current Liabilities',                0.00),

                ('EQUITY',                                      -2200.00),
                ('Unallocated Earnings',                        -2200.00),
                ('Current Year Unallocated Earnings',           200.00),
                ('Current Year Earnings',                       200.00),
                ('Current Year Allocated Earnings',             0.00),
                ('Previous Years Unallocated Earnings',         -2400.00),
                ('Retained Earnings',                           0.00),

                ('LIABILITIES + EQUITY',                        1830.00),
            ],
        )

        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('Receivables',                                 2075.00),
                ('121000 Account Receivable',                   2075.00),
            ],
        )

        options['unfolded_lines'] = []

        # ===================================================================================================
        # Check initial report with the 'totals_below_sections'.
        # ===================================================================================================

        self.company_parent.totals_below_sections = True
        lines = report._get_table(options)[1]

        self.assertLinesValues(
            lines,
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('ASSETS',                                      1830.00),
                ('Current Assets',                              1830.00),
                ('Bank and Cash Accounts',                      -1050.00),
                ('Receivables',                                 2075.00),
                ('Current Assets',                              805.00),
                ('Prepayments',                                 0.00),
                ('Total Current Assets',                        1830.00),
                ('Plus Fixed Assets',                           0.00),
                ('Plus Non-current Assets',                     0.00),
                ('Total ASSETS',                                1830.00),

                ('LIABILITIES',                                 4030.00),
                ('Current Liabilities',                         4030.00),
                ('Current Liabilities',                         375.00),
                ('Payables',                                    3655.00),
                ('Total Current Liabilities',                   4030.00),
                ('Plus Non-current Liabilities',                0.00),
                ('Total LIABILITIES',                           4030.00),

                ('EQUITY',                                      -2200.00),
                ('Unallocated Earnings',                        -2200.00),
                ('Current Year Unallocated Earnings',           200.00),
                ('Current Year Earnings',                       200.00),
                ('Current Year Allocated Earnings',             0.00),
                ('Total Current Year Unallocated Earnings',     200.00),
                ('Previous Years Unallocated Earnings',         -2400.00),
                ('Total Unallocated Earnings',                  -2200.00),
                ('Retained Earnings',                           0.00),
                ('Total EQUITY',                                -2200.00),

                ('LIABILITIES + EQUITY',                        1830.00),
            ],
        )

        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('Receivables',                                 2075.00),
                ('121000 Account Receivable',                   2075.00),
                ('Total Receivables',                           2075.00),
            ],
        )

        options['unfolded_lines'] = []

        # ===================================================================================================
        # Add multi_company / multi_currency.
        # ===================================================================================================

        company_ids = (self.company_parent + self.company_child_eur).ids
        report = self.env.ref('account_reports.account_financial_report_balancesheet0')\
            .with_context(allowed_company_ids=company_ids)._with_correct_filters()
        options = self._init_options(report, *date_utils.get_month(self.mar_year_minus_1))

        lines = report._get_table(options)[1]
        self.assertLinesValues(
            lines,
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('ASSETS',                                      3660.00),
                ('Current Assets',                              3660.00),
                ('Bank and Cash Accounts',                      -2100.00),
                ('Receivables',                                 4150.00),
                ('Current Assets',                              1610.00),
                ('Prepayments',                                 0.00),
                ('Total Current Assets',                        3660.00),
                ('Plus Fixed Assets',                           0.00),
                ('Plus Non-current Assets',                     0.00),
                ('Total ASSETS',                                3660.00),

                ('LIABILITIES',                                 8060.00),
                ('Current Liabilities',                         8060.00),
                ('Current Liabilities',                         750.00),
                ('Payables',                                    7310.00),
                ('Total Current Liabilities',                   8060.00),
                ('Plus Non-current Liabilities',                0.00),
                ('Total LIABILITIES',                           8060.00),

                ('EQUITY',                                      -4400.00),
                ('Unallocated Earnings',                        -4400.00),
                ('Current Year Unallocated Earnings',           400.00),
                ('Current Year Earnings',                       400.00),
                ('Current Year Allocated Earnings',             0.00),
                ('Total Current Year Unallocated Earnings',     400.00),
                ('Previous Years Unallocated Earnings',         -4800.00),
                ('Total Unallocated Earnings',                  -4400.00),
                ('Retained Earnings',                           0.00),
                ('Total EQUITY',                                -4400.00),

                ('LIABILITIES + EQUITY',                        3660.00),
            ],
        )

        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('Receivables',                                 4150.00),
                ('121000 Account Receivable',                   2075.00),
                ('121000 Account Receivable',                   2075.00),
                ('Total Receivables',                           4150.00),
            ],
        )

        options['unfolded_lines'] = []

        # ===================================================================================================
        # Add a comparison, check the growth column.
        # ===================================================================================================

        options = self._update_comparison_filter(options, report, 'previous_period', 1)

        lines = report._get_table(options)[1]
        self.assertLinesValues(
            lines,
            #   Name                                            Balance     Comparison  %
            [   0,                                              1,          2,          3],
            [
                ('ASSETS',                                      3660.00,    2700.00,    '35.6%'),
                ('Current Assets',                              3660.00,    2700.00,    '35.6%'),
                ('Bank and Cash Accounts',                      -2100.00,   -2300.00,   '-8.7%'),
                ('Receivables',                                 4150.00,    2970.00,    '39.7%'),
                ('Current Assets',                              1610.00,    2030.00,    '-20.7%'),
                ('Prepayments',                                 0.00,       0.00,       'n/a'),
                ('Total Current Assets',                        3660.00,    2700.00,    '35.6%'),
                ('Plus Fixed Assets',                           0.00,       0.00,       'n/a'),
                ('Plus Non-current Assets',                     0.00,       0.00,       'n/a'),
                ('Total ASSETS',                                3660.00,    2700.00,    '35.6%'),

                ('LIABILITIES',                                 8060.00,    7100.00,    '13.5%'),
                ('Current Liabilities',                         8060.00,    7100.00,    '13.5%'),
                ('Current Liabilities',                         750.00,     570.00,     '31.6%'),
                ('Payables',                                    7310.00,    6530.00,    '11.9%'),
                ('Total Current Liabilities',                   8060.00,    7100.00,    '13.5%'),
                ('Plus Non-current Liabilities',                0.00,       0.00,       'n/a'),
                ('Total LIABILITIES',                           8060.00,    7100.00,    '13.5%'),

                ('EQUITY',                                      -4400.00,   -4400.00,   '0.0%'),
                ('Unallocated Earnings',                        -4400.00,   -4400.00,   '0.0%'),
                ('Current Year Unallocated Earnings',           400.00,     400.00,     '0.0%'),
                ('Current Year Earnings',                       400.00,     400.00,     '0.0%'),
                ('Current Year Allocated Earnings',             0.00,       0.00,       'n/a'),
                ('Total Current Year Unallocated Earnings',     400.00,     400.00,     '0.0%'),
                ('Previous Years Unallocated Earnings',         -4800.00,   -4800.00,   '0.0%'),
                ('Total Unallocated Earnings',                  -4400.00,   -4400.00,   '0.0%'),
                ('Retained Earnings',                           0.00,       0.00,       'n/a'),
                ('Total EQUITY',                                -4400.00,   -4400.00,   '0.0%'),

                ('LIABILITIES + EQUITY',                        3660.00,    2700.00,    '35.6%'),
            ],
        )

        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            Balance     Comparison  %
            [   0,                                              1,          2,          3],
            [
                ('Receivables',                                 4150.00,    2970.00,    '39.7%'),
                ('121000 Account Receivable',                   2075.00,    1485.00,    '39.7%'),
                ('121000 Account Receivable',                   2075.00,    1485.00,    '39.7%'),
                ('Total Receivables',                           4150.00,    2970.00,    '39.7%'),
            ],
        )

        options['unfolded_lines'] = []

        # ===================================================================================================
        # Add a filter to see only 'partner_a'.
        # ===================================================================================================

        options = self._update_multi_selector_filter(options, 'ir_filters', self.ir_filters_partner_a.ids)

        lines = report._get_table(options)[1]
        self.assertLinesValues(
            lines,
            #   Name                                            Balance     Comparison  %
            [   0,                                              1,          2,          3],
            [
                ('ASSETS',                                      2540.00,    3050.00,    '-16.7%'),
                ('Current Assets',                              2540.00,    3050.00,    '-16.7%'),
                ('Bank and Cash Accounts',                      0.00,       0.00,       'n/a'),
                ('Receivables',                                 1790.00,    1790.00,    '0.0%'),
                ('Current Assets',                              750.00,     1260.00,    '-40.5%'),
                ('Prepayments',                                 0.00,       0.00,       'n/a'),
                ('Total Current Assets',                        2540.00,    3050.00,    '-16.7%'),
                ('Plus Fixed Assets',                           0.00,       0.00,       'n/a'),
                ('Plus Non-current Assets',                     0.00,       0.00,       'n/a'),
                ('Total ASSETS',                                2540.00,    3050.00,    '-16.7%'),

                ('LIABILITIES',                                 940.00,     850.00,     '10.6%'),
                ('Current Liabilities',                         940.00,     850.00,     '10.6%'),
                ('Current Liabilities',                         390.00,     390.00,     '0.0%'),
                ('Payables',                                    550.00,     460.00,     '19.6%'),
                ('Total Current Liabilities',                   940.00,     850.00,     '10.6%'),
                ('Plus Non-current Liabilities',                0.00,       0.00,       'n/a'),
                ('Total LIABILITIES',                           940.00,     850.00,     '10.6%'),

                ('EQUITY',                                      1600.00,    2200.00,    '-27.3%'),
                ('Unallocated Earnings',                        1600.00,    2200.00,    '-27.3%'),
                ('Current Year Unallocated Earnings',           -800.00,    -200.00,    '300.0%'),
                ('Current Year Earnings',                       -800.00,    -200.00,    '300.0%'),
                ('Current Year Allocated Earnings',             0.00,       0.00,       'n/a'),
                ('Total Current Year Unallocated Earnings',     -800.00,    -200.00,    '300.0%'),
                ('Previous Years Unallocated Earnings',         2400.00,    2400.00,    '0.0%'),
                ('Total Unallocated Earnings',                  1600.00,    2200.00,    '-27.3%'),
                ('Retained Earnings',                           0.00,       0.00,       'n/a'),
                ('Total EQUITY',                                1600.00,    2200.00,    '-27.3%'),

                ('LIABILITIES + EQUITY',                        2540.00,    3050.00,    '-16.7%'),
            ],
        )

        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #                                                   [ Balance ]     [ Comparison ]
            [   0,                                              1],
            [
                ('Receivables',                                 1790.00,    1790.00,    '0.0%'),
                ('121000 Account Receivable',                   895.00,     895.00,     '0.0%'),
                ('121000 Account Receivable',                   895.00,     895.00,     '0.0%'),
                ('Total Receivables',                           1790.00,    1790.00,    '0.0%'),
            ],
        )

        options['unfolded_lines'] = []

        # ===================================================================================================
        # Add a group by on ('company_id', 'partner_id').
        # ===================================================================================================

        options = self._update_multi_selector_filter(options, 'ir_filters', (self.ir_filters_partner_a + self.ir_filters_groupby_partner_id_company_id).ids)

        headers, lines = report._get_table(options)
        self.assertHeadersValues(headers, [
            [   ('', 1),                                                    ('As of 03/31/2017',  2),                       ('As of 02/28/2017', 2)],
            [   ('', 1),                                        ('company_child_eur', 1),   ('company_parent', 1),  ('company_child_eur', 1),   ('company_parent', 1)],
            [   ('', 1),                                        ('partner_a', 1),           ('partner_a', 1),       ('partner_a', 1),           ('partner_a', 1)],
        ])
        self.assertLinesValues(
            lines,
            [   0,                                              1,                          2,                      3,                          4],
            [
                ('ASSETS',                                      1270.00,                    1270.00,                1525.00,                    1525.00),
                ('Current Assets',                              1270.00,                    1270.00,                1525.00,                    1525.00),
                ('Bank and Cash Accounts',                      0.00,                       0.00,                   0.00,                       0.00),
                ('Receivables',                                 895.00,                     895.00,                 895.00,                     895.00),
                ('Current Assets',                              375.00,                     375.00,                 630.00,                     630.00),
                ('Prepayments',                                 0.00,                       0.00,                   0.00,                       0.00),
                ('Total Current Assets',                        1270.00,                    1270.00,                1525.00,                    1525.00),
                ('Plus Fixed Assets',                           0.00,                       0.00,                   0.00,                       0.00),
                ('Plus Non-current Assets',                     0.00,                       0.00,                   0.00,                       0.00),
                ('Total ASSETS',                                1270.00,                    1270.00,                1525.00,                    1525.00),

                ('LIABILITIES',                                 470.00,                     470.00,                 425.00,                     425.00),
                ('Current Liabilities',                         470.00,                     470.00,                 425.00,                     425.00),
                ('Current Liabilities',                         195.00,                     195.00,                 195.00,                     195.00),
                ('Payables',                                    275.00,                     275.00,                 230.00,                     230.00),
                ('Total Current Liabilities',                   470.00,                     470.00,                 425.00,                     425.00),
                ('Plus Non-current Liabilities',                0.00,                       0.00,                   0.00,                       0.00),
                ('Total LIABILITIES',                           470.00,                     470.00,                 425.00,                     425.00),

                ('EQUITY',                                      800.00,                     800.00,                 1100.00,                    1100.00),
                ('Unallocated Earnings',                        800.00,                     800.00,                 1100.00,                    1100.00),
                ('Current Year Unallocated Earnings',           -400.00,                    -400.00,                -100.00,                    -100.00),
                ('Current Year Earnings',                       -400.00,                    -400.00,                -100.00,                    -100.00),
                ('Current Year Allocated Earnings',             0.00,                       0.00,                   0.00,                       0.00),
                ('Total Current Year Unallocated Earnings',     -400.00,                    -400.00,                -100.00,                    -100.00),
                ('Previous Years Unallocated Earnings',         1200.00,                    1200.00,                1200.00,                    1200.00),
                ('Total Unallocated Earnings',                  800.00,                     800.00,                 1100.00,                    1100.00),
                ('Retained Earnings',                           0.00,                       0.00,                   0.00,                       0.00),
                ('Total EQUITY',                                800.00,                     800.00,                 1100.00,                    1100.00),

                ('LIABILITIES + EQUITY',                        1270.00,                    1270.00,                1525.00,                    1525.00),
            ]
        )

        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            [   0,                                              1,                          2,                      3,                          4],
            [
                ('Receivables',                                 895.00,                     895.00,                 895.00,                     895.00),
                ('121000 Account Receivable',                   895.00,                     0.00,                   895.00,                     0.00),
                ('121000 Account Receivable',                   0.00,                       895.00,                 0.00,                       895.00),
                ('Total Receivables',                           895.00,                     895.00,                 895.00,                     895.00),
            ],
        )

        options['unfolded_lines'] = []

        # ===================================================================================================
        # Add a filter on the 'Bank' journal.
        # ===================================================================================================

        journal = self.env['account.journal'].search([('company_id', '=', self.company_parent.id), ('type', '=', 'bank')])
        options = self._update_multi_selector_filter(options, 'journals', journal.ids)

        headers, lines = report._get_table(options)
        self.assertHeadersValues(headers, [
            [   ('', 1),                                        ('As of 03/31/2017',  1),   ('As of 02/28/2017', 1)],
            [   ('', 1),                                        ('company_parent', 1),      ('company_parent', 1)],
            [   ('', 1),                                        ('partner_a', 1),           ('partner_a', 1)],
        ])
        self.assertLinesValues(
            lines,
            [   0,                                              1,                          2],
            [
                ('ASSETS',                                      -300.00,                    0.00),
                ('Current Assets',                              -300.00,                    0.00),
                ('Bank and Cash Accounts',                      0.00,                       0.00),
                ('Receivables',                                 -600.00,                    -600.00),
                ('Current Assets',                              300.00,                     600.00),
                ('Prepayments',                                 0.00,                       0.00),
                ('Total Current Assets',                        -300.00,                    0.00),
                ('Plus Fixed Assets',                           0.00,                       0.00),
                ('Plus Non-current Assets',                     0.00,                       0.00),
                ('Total ASSETS',                                -300.00,                    0.00),

                ('LIABILITIES',                                 -300.00,                    0.00),
                ('Current Liabilities',                         -300.00,                    0.00),
                ('Current Liabilities',                         0.00,                       0.00),
                ('Payables',                                    -300.00,                    0.00),
                ('Total Current Liabilities',                   -300.00,                    0.00),
                ('Plus Non-current Liabilities',                0.00,                       0.00),
                ('Total LIABILITIES',                           -300.00,                    0.00),

                ('EQUITY',                                      0.00,                       0.00),
                ('Unallocated Earnings',                        0.00,                       0.00),
                ('Current Year Unallocated Earnings',           0.00,                       0.00),
                ('Current Year Earnings',                       0.00,                       0.00),
                ('Current Year Allocated Earnings',             0.00,                       0.00),
                ('Total Current Year Unallocated Earnings',     0.00,                       0.00),
                ('Previous Years Unallocated Earnings',         0.00,                       0.00),
                ('Total Unallocated Earnings',                  0.00,                       0.00),
                ('Retained Earnings',                           0.00,                       0.00),
                ('Total EQUITY',                                0.00,                       0.00),

                ('LIABILITIES + EQUITY',                        -300.00,                    0.00),
            ]
        )

        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            [   0,                                              1,                          2],
            [
                ('Receivables',                                 -600.00,                    -600.00),
                ('121000 Account Receivable',                   -600.00,                    -600.00),
                ('Total Receivables',                           -600.00,                    -600.00),
            ],
        )

        options['unfolded_lines'] = []

    # -------------------------------------------------------------------------
    # TESTS: Cash Flow Statement
    # -------------------------------------------------------------------------

    def test_cash_flow_statement_1(self):
        liquidity_journal_1 = self.env['account.journal'].search([
            ('type', 'in', ('bank', 'cash')), ('company_id', '=', self.company_parent.id),
        ], limit=1)
        liquidity_account = liquidity_journal_1.default_credit_account_id
        receivable_account_1 = self.env['account.account'].search([
            ('user_type_id.type', '=', 'receivable'), ('company_id', '=', self.company_parent.id), ('code', 'like', '1210%')
        ], limit=1)
        receivable_account_2 = receivable_account_1.copy()
        receivable_account_2.name = 'Account Receivable 2'
        receivable_account_3 = receivable_account_1.copy()
        receivable_account_3.name = 'Account Receivable 3'
        other_account_1 = receivable_account_1.copy(default={'user_type_id': self.env.ref('account.data_account_type_current_assets').id, 'reconcile': True})
        other_account_1.name = 'Other account 1'
        other_account_2 = receivable_account_1.copy(default={'user_type_id': self.env.ref('account.data_account_type_current_assets').id, 'reconcile': True})
        other_account_2.name = 'Other account 2'
        other_account_2.tag_ids |= self.env.ref('account.account_tag_financing')
        other_account_3 = receivable_account_1.copy(default={'user_type_id': self.env.ref('account.data_account_type_current_assets').id, 'reconcile': True})
        other_account_3.name = 'account_operating'
        other_account_3.tag_ids |= self.env.ref('account.account_tag_operating')

        def assertCashFlowValues(lines, expected_lines):
            folded_lines = []
            for line in lines:
                self.assertNotEqual(line['id'], 'cash_flow_line_unexplained_difference', 'Test failed due to an unexplained difference in the report.')
                if line.get('style') != 'display: none;':
                    folded_lines.append(line)
            self.assertLinesValues(folded_lines, [0, 1], expected_lines)

        expected_lines = [
            ['Cash and cash equivalents, beginning of period',                      0.0],
            ['Net increase in cash and cash equivalents',                           0.0],
            ['Cash flows from operating activities',                                0.0],
            ['Advance Payments received from customers',                            0.0],
            ['Cash received from operating activities',                             0.0],
            ['Advance payments made to suppliers',                                  0.0],
            ['Cash paid for operating activities',                                  0.0],
            ['Cash flows from investing & extraordinary activities',                0.0],
            ['Cash in',                                                             0.0],
            ['Cash out',                                                            0.0],
            ['Cash flows from financing activities',                                0.0],
            ['Cash in',                                                             0.0],
            ['Cash out',                                                            0.0],
            ['Cash flows from unclassified activities',                             0.0],
            ['Cash in',                                                             0.0],
            ['Cash out',                                                            0.0],
            ['Cash and cash equivalents, closing balance',                          0.0],
        ]

        # Init report / options.
        report = self.env['account.cash.flow.report'].with_company(self.company_parent)
        options = self._init_options(report, *date_utils.get_month(fields.Date.from_string('2015-01-01')))

        # ===================================================================================================
        # CASE 1:
        #
        # Invoice:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 1   | Receivable      | 345       |         | 2015-01-01
        # 2   | Receivable      | 805       |         | 2015-01-01
        # 3   | Tax Received    |           | 150     | 2015-01-01
        # 4   | Product Sales   |           | 1000    | 2015-01-01
        #
        # Payment 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 4   | Receivable      |           | 230     | 2015-01-15
        # 5   | Bank            | 230       |         | 2015-01-15
        #
        # Payment 2:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 6   | Receivable      |           | 230     | 2015-02-01
        # 7   | Bank            | 230       |         | 2015-02-01
        #
        # Payment 3:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 8   | Receivable      |           | 1690    | 2015-02-15
        # 9   | Bank            | 1690      |         | 2015-02-15
        #
        # Reconciliation table (account.partial.reconcile):
        # Debit id    | Credit id     | Amount
        # ---------------------------------------------------
        # 1           | 4             | 230
        # 1           | 6             | 115
        # 2           | 6             | 115
        # 2           | 8             | 690
        #
        # Summary:
        # The invoice is paid at 60% (690 / 1150).
        # All payments are fully reconciled except the third that has 1000 credit left on the receivable account.
        # ===================================================================================================

        # Init invoice.
        self.partner_a.property_payment_term_id = self.env.ref('account.account_payment_term_advance')
        invoice = self.env['account.move'].create({
            'move_type': 'entry',
            'date': '2015-01-01',
            'line_ids': [
                (0, 0, {'debit': 345.0,     'credit': 0.0,      'account_id': receivable_account_1.id}),
                (0, 0, {'debit': 805.0,     'credit': 0.0,      'account_id': receivable_account_1.id}),
                (0, 0, {'debit': 0.0,       'credit': 150.0,    'account_id': other_account_1.id}),
                (0, 0, {'debit': 0.0,       'credit': 1000.0,   'account_id': other_account_3.id}),
            ],
        })
        invoice.post()

        # First payment.
        # The tricky part is there is two receivable lines on the invoice.
        payment_1 = self.env['account.move'].create({
            'move_type': 'entry',
            'date': '2015-01-15',
            'line_ids': [
                (0, 0, {'debit': 0.0,       'credit': 230.0,    'account_id': receivable_account_1.id}),
                (0, 0, {'debit': 230.0,     'credit': 0.0,      'account_id': liquidity_account.id}),
            ],
        })
        payment_1.action_post()

        (invoice + payment_1).line_ids\
            .filtered(lambda line: line.account_id == receivable_account_1 and not line.reconciled)\
            .reconcile()

        options['date']['date_to'] = '2015-01-15'
        expected_lines[1][1] += 230.0               # Net increase in cash and cash equivalents         230.0
        expected_lines[2][1] += 200.0               # Cash flows from operating activities              200.0
        expected_lines[4][1] += 200.0               # Cash received from operating activities           200.0
        expected_lines[13][1] += 30.0               # Cash flows from unclassified activities           30.0
        expected_lines[14][1] += 30.0               # Cash in                                           30.0
        expected_lines[16][1] += 230.0              # Cash and cash equivalents, closing balance        230.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # Second payment.
        # The tricky part is two partials will be generated, one for each receivable line.
        payment_2 = self.env['account.move'].create({
            'move_type': 'entry',
            'date': '2015-02-01',
            'line_ids': [
                (0, 0, {'debit': 0.0,       'credit': 230.0,    'account_id': receivable_account_1.id}),
                (0, 0, {'debit': 230.0,     'credit': 0.0,      'account_id': liquidity_account.id}),
            ],
        })
        payment_2.action_post()

        (invoice + payment_2).line_ids\
            .filtered(lambda line: line.account_id == receivable_account_1 and not line.reconciled)\
            .reconcile()

        options['date']['date_to'] = '2015-02-01'
        expected_lines[1][1] += 230.0               # Net increase in cash and cash equivalents         460.0
        expected_lines[2][1] += 200.0               # Cash flows from operating activities              400.0
        expected_lines[4][1] += 200.0               # Cash received from operating activities           400.0
        expected_lines[13][1] += 30.0               # Cash flows from unclassified activities           60.0
        expected_lines[14][1] += 30.0               # Cash in                                           60.0
        expected_lines[16][1] += 230.0              # Cash and cash equivalents, closing balance        460.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # Third payment.
        # The tricky part is this payment will generate an advance in payments.
        payment_3 = self.env['account.move'].create({
            'move_type': 'entry',
            'date': '2015-02-15',
            'line_ids': [
                (0, 0, {'debit': 0.0,       'credit': 1690.0,   'account_id': receivable_account_1.id}),
                (0, 0, {'debit': 1690.0,    'credit': 0.0,      'account_id': liquidity_account.id}),
            ],
        })
        payment_3.action_post()

        (invoice + payment_3).line_ids\
            .filtered(lambda line: line.account_id == receivable_account_1 and not line.reconciled)\
            .reconcile()

        options['date']['date_to'] = '2015-02-15'
        expected_lines[1][1] += 1690.0              # Net increase in cash and cash equivalents         2150.0
        expected_lines[2][1] += 1600.0              # Cash flows from operating activities              2000.0
        expected_lines[3][1] += 1000.0              # Advance Payments received from customers          1000.0
        expected_lines[4][1] += 600.0               # Cash received from operating activities           1000.0
        expected_lines[13][1] += 90.0               # Cash flows from unclassified activities           150.0
        expected_lines[14][1] += 90.0               # Cash in                                           150.0
        expected_lines[16][1] += 1690.0             # Cash and cash equivalents, closing balance        2150.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # Second invoice.
        # As the report date is unchanged, this reconciliation must not affect the report.
        # It ensures the residual amounts is computed dynamically depending of the report date.
        # Then, when including the invoice to the report, the advance payments must become a cash received.
        invoice_2 = self.env['account.move'].create({
            'move_type': 'entry',
            'date': '2015-03-01',
            'line_ids': [
                (0, 0, {'debit': 1000.0,    'credit': 0.0,      'account_id': receivable_account_1.id}),
                (0, 0, {'debit': 0.0,       'credit': 1000.0,   'account_id': other_account_3.id}),
            ],
        })
        invoice_2.post()

        (invoice_2 + payment_3).line_ids\
            .filtered(lambda line: line.account_id == receivable_account_1 and not line.reconciled)\
            .reconcile()

        assertCashFlowValues(report._get_lines(options), expected_lines)

        options['date']['date_to'] = '2015-03-15'
        expected_lines[3][1] -= 1000.0              # Advance Payments received from customers          0.0
        expected_lines[4][1] += 1000.0              # Cash received from operating activities           2000.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # ===================================================================================================
        # CASE 2:
        # Test the variation of the reconciled percentage from 800 / 1000 = 80% to 3800 / 4000 = 95%.
        # Also test the cross-reconciliation between liquidity moves doesn't break the report.
        #
        # Liquidity move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 5   | Receivable 1    | 800       |         | 2015-04-01
        # 6   | Receivable 3    |           | 250     | 2015-04-01
        # 7   | other 1         |           | 250     | 2015-04-01
        # 8   | Bank            |           | 300     | 2015-04-01
        #
        # Misc. move.
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 1   | Receivable 1    |           | 1000    | 2015-04-02
        # 2   | other 1         |           | 500     | 2015-04-02
        # 3   | other 2         | 4500      |         | 2015-04-02
        # 4   | Receivable 2    |           | 3000    | 2015-04-02
        #
        # Liquidity move 2:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 9   | Receivable 2    | 3200      |         | 2015-04-03
        # 10  | Receivable 3    | 200       |         | 2015-04-03
        # 11  | other 2         |           | 400     | 2015-04-03
        # 12  | Bank            |           | 3000    | 2015-04-03
        #
        # Reconciliation table (account.partial.reconcile):
        # Debit id    | Credit id     | Amount
        # ---------------------------------------------------
        # 5           | 1             | 800
        # 9           | 4             | 115
        # 10          | 6             | 200
        # ===================================================================================================

        # First liquidity move.
        liquidity_move_1 = self.env['account.move'].create({
            'date': '2015-04-01',
            'line_ids': [
                (0, 0, {'debit': 800.0, 'credit': 0.0, 'account_id': receivable_account_1.id}),
                (0, 0, {'debit': 0.0, 'credit': 250.0, 'account_id': receivable_account_3.id}),
                (0, 0, {'debit': 0.0, 'credit': 250.0, 'account_id': other_account_1.id}),
                (0, 0, {'debit': 0.0, 'credit': 300.0, 'account_id': liquidity_account.id}),
            ],
        })
        liquidity_move_1.post()

        options['date']['date_to'] = '2015-04-01'
        expected_lines[1][1] -= 300.0               # Net increase in cash and cash equivalents         1850.0
        expected_lines[2][1] -= 550.0               # Cash flows from operating activities              1450.0
        expected_lines[3][1] -= 550.0               # Advance Payments received from customers          -550.0
        expected_lines[13][1] += 250.0              # Cash flows from unclassified activities           400.0
        expected_lines[14][1] += 250.0              # Cash in                                           400.0
        expected_lines[16][1] -= 300.0              # Cash and cash equivalents, closing balance        1850.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # Misc. move.
        # /!\ This move is reconciled at 800 / (1000 + 3000) = 20%.
        misc_move = self.env['account.move'].create({
            'date': '2015-04-02',
            'line_ids': [
                (0, 0, {'debit': 0.0, 'credit': 1000.0, 'account_id': receivable_account_1.id}),
                (0, 0, {'debit': 0.0, 'credit': 500.0, 'account_id': other_account_1.id}),
                (0, 0, {'debit': 4500.0, 'credit': 0.0, 'account_id': other_account_2.id}),
                (0, 0, {'debit': 0.0, 'credit': 3000.0, 'account_id': receivable_account_2.id}),
            ],
        })
        misc_move.post()

        (liquidity_move_1.line_ids + misc_move.line_ids)\
            .filtered(lambda line: line.account_id == receivable_account_1 and not line.reconciled)\
            .reconcile()

        options['date']['date_to'] = '2015-04-02'
        expected_lines[2][1] += 3200.0              # Cash flows from operating activities              4650.0
        expected_lines[3][1] += 3200.0              # Advance Payments received from customers          2650.0
        expected_lines[10][1] -= 3600.0             # Cash flows from financing activities              -3600.0
        expected_lines[12][1] -= 3600.0             # Cash out                                          -3600.0
        expected_lines[13][1] += 400.0              # Cash flows from unclassified activities           800.0
        expected_lines[14][1] += 400.0              # Cash in                                           800.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # Second liquidity move.
        liquidity_move_2 = self.env['account.move'].create({
            'date': '2015-04-03',
            'line_ids': [
                (0, 0, {'debit': 3200.0, 'credit': 0.0, 'account_id': receivable_account_2.id}),
                (0, 0, {'debit': 200.0, 'credit': 0.0, 'account_id': receivable_account_3.id}),
                (0, 0, {'debit': 0.0, 'credit': 400.0, 'account_id': other_account_2.id}),
                (0, 0, {'debit': 0.0, 'credit': 3000.0, 'account_id': liquidity_account.id}),
            ],
        })
        liquidity_move_2.post()

        # misc_move is now paid at 95%.
        (liquidity_move_2.line_ids + misc_move.line_ids)\
            .filtered(lambda line: line.account_id == receivable_account_2)\
            .reconcile()

        options['date']['date_to'] = '2015-04-03'
        expected_lines[1][1] -= 3000.0              # Net increase in cash and cash equivalents         -1150.0
        expected_lines[2][1] -= 2800.0              # Cash flows from operating activities              1850.0
        expected_lines[3][1] -= 2800.0              # Advance Payments received from customers          -150.0
        expected_lines[10][1] -= 275.0              # Cash flows from financing activities              -3875.0
        expected_lines[11][1] += 400.0              # Cash in                                           400.0
        expected_lines[12][1] -= 675.0              # Cash out                                          -4275.0
        expected_lines[13][1] += 75.0               # Cash flows from unclassified activities           875.0
        expected_lines[14][1] += 75.0               # Cash in                                           875.0
        expected_lines[16][1] -= 3000.0             # Cash and cash equivalents, closing balance        -1150.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # Nothing should change in the cash flow report.
        (liquidity_move_1.line_ids + liquidity_move_2.line_ids)\
            .filtered(lambda line: line.account_id == receivable_account_3)\
            .reconcile()

        assertCashFlowValues(report._get_lines(options), expected_lines)

        # ===================================================================================================
        # TEST THE UNFOLDED REPORT
        # ===================================================================================================

        self.assertLinesValues(report._get_lines(options), [0, 1], [
            ['Cash and cash equivalents, beginning of period',                      0.0],
            ['Net increase in cash and cash equivalents',                           -1150.0],
            ['Cash flows from operating activities',                                1850.0],
            ['Advance Payments received from customers',                            -150.0],
            ['121010 Account Receivable 2',                                         -200.0],
            ['121020 Account Receivable 3',                                         50.0],
            ['Total Advance Payments received from customers',                      -150.0],
            ['Cash received from operating activities',                             2000.0],
            ['121050 account_operating',                                            2000.0],
            ['Total Cash received from operating activities',                       2000.0],
            ['Advance payments made to suppliers',                                  0.0],
            ['Cash paid for operating activities',                                  0.0],
            ['Cash flows from investing & extraordinary activities',                0.0],
            ['Cash in',                                                             0.0],
            ['Cash out',                                                            0.0],
            ['Cash flows from financing activities',                                -3875.0],
            ['Cash in',                                                             400.0],
            ['121040 Other account 2',                                              400.0],
            ['Total Cash in',                                                       400.0],
            ['Cash out',                                                            -4275.0],
            ['121040 Other account 2',                                              -4275.0],
            ['Total Cash out',                                                      -4275.0],
            ['Cash flows from unclassified activities',                             875.0],
            ['Cash in',                                                             875.0],
            ['121030 Other account 1',                                              875.0],
            ['Total Cash in',                                                       875.0],
            ['Cash out',                                                            0.0],
            ['Cash and cash equivalents, closing balance',                          -1150.0],
            ['101401 Bank',                                                         -1150.0],
            ['Total Cash and cash equivalents, closing balance',                    -1150.0],
        ])

        # ===================================================================================================
        # CASE 3:
        #
        # Misc move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 1   | other 1         |           | 500     | 2015-05-01
        # 2   | other 2         | 500       |         | 2015-05-01
        #
        # Liquidity move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 3   | Bank            | 1000      |         | 2015-05-01
        # 4   | other 2         |           | 500     | 2015-05-01
        # 5   | other 2         |           | 500     | 2015-05-01
        #
        # Liquidity move 2:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 6   | Bank            |           | 500     | 2015-05-02
        # 7   | other 2         | 500       |         | 2015-05-02
        #
        # Reconciliation table (account.partial.reconcile):
        # Debit id    | Credit id     | Amount
        # ---------------------------------------------------
        # 2           | 4             | 500
        # 7           | 5             | 500
        # ===================================================================================================

        # Reset the report at 2015-05-01.
        options['date']['date_from'] = '2015-05-01'
        for line in expected_lines:
            line[1] = 0
        expected_lines[0][1] -= 1150.0              # Cash and cash equivalents, beginning of period    -1150.0
        expected_lines[16][1] -= 1150.0             # Cash and cash equivalents, closing balance        -1150.0

        # Init moves + reconciliation.
        moves = self.env['account.move'].create([
            {
                'date': '2015-05-01',
                'line_ids': [
                    (0, 0, {'debit': 0.0, 'credit': 500.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 500.0, 'credit': 0.0, 'account_id': other_account_2.id}),
                ],
            },
            {
                'date': '2015-05-01',
                'line_ids': [
                    (0, 0, {'debit': 1000.0, 'credit': 0.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 0.0, 'credit': 500.0, 'account_id': other_account_2.id}),
                    (0, 0, {'debit': 0.0, 'credit': 500.0, 'account_id': other_account_2.id}),
                ],
            },
            {
                'date': '2015-05-02',
                'line_ids': [
                    (0, 0, {'debit': 0.0, 'credit': 500.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 500.0, 'credit': 0.0, 'account_id': other_account_2.id}),
                ],
            },
        ])
        moves.post()

        moves.mapped('line_ids')\
            .filtered(lambda line: line.account_id == other_account_2)\
            .reconcile()

        options['date']['date_to'] = '2015-05-01'
        expected_lines[1][1] += 1000.0              # Net increase in cash and cash equivalents         1000.0
        expected_lines[10][1] += 500.0              # Cash flows from financing activities              500.0
        expected_lines[11][1] += 500.0              # Cash in                                           500.0
        expected_lines[13][1] += 500.0              # Cash flows from unclassified activities           500.0
        expected_lines[14][1] += 500.0              # Cash in                                           500.0
        expected_lines[16][1] += 1000.0             # Cash and cash equivalents, closing balance        -150.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        options['date']['date_to'] = '2015-05-02'
        expected_lines[1][1] -= 500.0               # Net increase in cash and cash equivalents         500.0
        expected_lines[10][1] -= 500.0              # Cash flows from financing activities              0.0
        expected_lines[11][1] -= 500.0              # Cash in                                           0.0
        expected_lines[16][1] -= 500.0              # Cash and cash equivalents, closing balance        -650.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # ===================================================================================================
        # CASE 4:
        # The difficulty of this case is the liquidity move will pay the misc move at 1000 / 3000 = 1/3.
        # However, you must take care of the sign because the 3000 in credit must become 1000 in debit.
        #
        # Misc move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 1   | other 1         |           | 3000    | 2015-06-01
        # 2   | other 2         | 5000      |         | 2015-06-01
        # 3   | other 2         |           | 1000    | 2015-06-01
        # 4   | other 2         |           | 1000    | 2015-06-01
        #
        # Liquidity move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 5   | Bank            |           | 1000    | 2015-06-01
        # 6   | other 2         | 1000      |         | 2015-06-01
        #
        # Reconciliation table (account.partial.reconcile):
        # Debit id    | Credit id     | Amount
        # ---------------------------------------------------
        # 6           | 3             | 1000
        # ===================================================================================================

        # Init moves + reconciliation.
        moves = self.env['account.move'].create([
            {
                'date': '2015-06-01',
                'line_ids': [
                    (0, 0, {'debit': 0.0, 'credit': 3000.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 5000.0, 'credit': 0.0, 'account_id': other_account_2.id}),
                    (0, 0, {'debit': 0.0, 'credit': 1000.0, 'account_id': other_account_2.id}),
                    (0, 0, {'debit': 0.0, 'credit': 1000.0, 'account_id': other_account_2.id}),
                ],
            },
            {
                'date': '2015-06-01',
                'line_ids': [
                    (0, 0, {'debit': 0.0, 'credit': 1000.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 1000.0, 'credit': 0.0, 'account_id': other_account_2.id}),
                ],
            },
        ])
        moves.post()

        moves.mapped('line_ids')\
            .filtered(lambda line: line.account_id == other_account_2 and abs(line.balance) == 1000.0)\
            .reconcile()

        options['date']['date_to'] = '2015-06-01'
        expected_lines[1][1] -= 1000.0              # Net increase in cash and cash equivalents         -500.0
        expected_lines[13][1] -= 1000.0             # Cash flows from unclassified activities           -500.0
        expected_lines[14][1] -= 500.0              # Cash in                                            0.0
        expected_lines[15][1] -= 500.0              # Cash out                                          -500.0
        expected_lines[16][1] -= 1000.0             # Cash and cash equivalents, closing balance        -1650.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # ===================================================================================================
        # CASE 5:
        # Same as case 4 but this time, the liquidity move is creditor.
        #
        # Misc move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 1   | other 1         | 3000      |         | 2015-06-02
        # 2   | other 2         |           | 5000    | 2015-06-02
        # 3   | other 2         | 1000      |         | 2015-06-02
        # 4   | other 2         | 1000      |         | 2015-06-02
        #
        # Liquidity move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 5   | Bank            | 1000      |         | 2015-06-02
        # 6   | other 2         |           | 1000    | 2015-06-02
        #
        # Reconciliation table (account.partial.reconcile):
        # Debit id    | Credit id     | Amount
        # ---------------------------------------------------
        # 3           | 6             | 1000
        # ===================================================================================================

        # Init moves + reconciliation.
        moves = self.env['account.move'].create([
            {
                'date': '2015-06-01',
                'line_ids': [
                    (0, 0, {'debit': 3000.0, 'credit': 0.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 0.0, 'credit': 5000.0, 'account_id': other_account_2.id}),
                    (0, 0, {'debit': 1000.0, 'credit': 0.0, 'account_id': other_account_2.id}),
                    (0, 0, {'debit': 1000.0, 'credit': 0.0, 'account_id': other_account_2.id}),
                ],
            },
            {
                'date': '2015-06-01',
                'line_ids': [
                    (0, 0, {'debit': 1000.0, 'credit': 0.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 0.0, 'credit': 1000.0, 'account_id': other_account_2.id}),
                ],
            },
        ])
        moves.post()

        moves.mapped('line_ids')\
            .filtered(lambda line: line.account_id == other_account_2 and abs(line.balance) == 1000.0)\
            .reconcile()

        options['date']['date_to'] = '2015-06-01'
        expected_lines[1][1] += 1000.0              # Net increase in cash and cash equivalents         0.0
        expected_lines[13][1] += 1000.0             # Cash flows from unclassified activities           500.0
        expected_lines[14][1] += 500.0              # Cash in                                           500.0
        expected_lines[15][1] += 500.0              # Cash out                                          0.0
        expected_lines[16][1] += 1000.0             # Cash and cash equivalents, closing balance        -650.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # ===================================================================================================
        # CASE 6:
        # Test the additional lines on liquidity moves (e.g. bank fees) are well reported in the cash flow statement.
        #
        # Liquidity move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 1   | Bank            | 3000      |         | 2015-07-01
        # 2   | other 2         |           | 1000    | 2015-07-01
        # 3   | Receivable 2    |           | 2000    | 2015-07-01
        #
        # Liquidity move 2:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 4   | Bank            |           | 3000    | 2015-07-01
        # 5   | other 1         | 1000      |         | 2015-07-01
        # 6   | Receivable 1    | 2000      |         | 2015-07-01
        #
        # Liquidity move 3:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 7   | Bank            | 1000      |         | 2015-07-01
        # 8   | other 1         | 1000      |         | 2015-07-01
        # 9   | Receivable 2    |           | 2000    | 2015-07-01
        #
        # Liquidity move 4:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 10  | Bank            |           | 1000    | 2015-07-01
        # 11  | other 2         |           | 1000    | 2015-07-01
        # 12  | Receivable 1    | 2000      |         | 2015-07-01
        #
        # Misc move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 13  | Receivable 1    |           | 4000    | 2015-07-01
        # 14  | Receivable 2    | 4000      |         | 2015-07-01
        #
        # Reconciliation table (account.partial.reconcile):
        # Debit id    | Credit id     | Amount
        # ---------------------------------------------------
        # 13          | 12            | 2000
        # 13          | 6             | 2000
        # 14          | 3             | 2000
        # 14          | 9             | 2000
        # ===================================================================================================

        # Init moves + reconciliation.
        moves = self.env['account.move'].create([
            {
                'date': '2015-07-01',
                'line_ids': [
                    (0, 0, {'debit': 3000.0, 'credit': 0.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 0.0, 'credit': 1000.0, 'account_id': other_account_2.id}),
                    (0, 0, {'debit': 0.0, 'credit': 2000.0, 'account_id': receivable_account_2.id}),
                ],
            },
            {
                'date': '2015-07-01',
                'line_ids': [
                    (0, 0, {'debit': 0.0, 'credit': 3000.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 1000.0, 'credit': 0.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 2000.0, 'credit': 0.0, 'account_id': receivable_account_1.id}),
                ],
            },
            {
                'date': '2015-07-01',
                'line_ids': [
                    (0, 0, {'debit': 1000.0, 'credit': 0.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 1000.0, 'credit': 0.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 0.0, 'credit': 2000.0, 'account_id': receivable_account_2.id}),
                ],
            },
            {
                'date': '2015-07-01',
                'line_ids': [
                    (0, 0, {'debit': 0.0, 'credit': 1000.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 0.0, 'credit': 1000.0, 'account_id': other_account_2.id}),
                    (0, 0, {'debit': 2000.0, 'credit': 0.0, 'account_id': receivable_account_1.id}),
                ],
            },
            {
                'date': '2015-07-01',
                'line_ids': [
                    (0, 0, {'debit': 0.0, 'credit': 4000.0, 'account_id': receivable_account_1.id}),
                    (0, 0, {'debit': 4000.0, 'credit': 0.0, 'account_id': receivable_account_2.id}),
                ],
            },
        ])
        moves.post()

        moves.mapped('line_ids')\
            .filtered(lambda line: line.account_id == receivable_account_1)\
            .reconcile()
        moves.mapped('line_ids')\
            .filtered(lambda line: line.account_id == receivable_account_2)\
            .reconcile()

        options['date']['date_to'] = '2015-07-01'
        expected_lines[10][1] += 2000.0             # Cash flows from financing activities              2000.0
        expected_lines[11][1] += 2000.0             # Cash in                                           2000.0
        expected_lines[13][1] -= 2000.0             # Cash flows from unclassified activities           -1500.0
        expected_lines[15][1] -= 2000.0             # Cash out                                          -3000.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # ===================================================================================================
        # CASE 7:
        # Liquidity moves are reconciled on the bank account.
        #
        # Liquidity move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 1   | Bank            | 3000      |         | 2015-07-01
        # 2   | other 2         |           | 1000    | 2015-07-01
        # 3   | Receivable 2    |           | 2000    | 2015-07-01
        #
        # Liquidity move 2:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 4   | Bank            |           | 1500    | 2015-07-01
        # 5   | other 1         | 500       |         | 2015-07-01
        # 6   | Receivable 1    | 1000      |         | 2015-07-01
        #
        # Reconciliation table (account.partial.reconcile):
        # Debit id    | Credit id     | Amount
        # ---------------------------------------------------
        # 1           | 4             | 1500
        # ===================================================================================================

        # Reset the report at 2015-08-01.
        options['date']['date_from'] = '2015-08-01'
        for line in expected_lines:
            line[1] = 0
        expected_lines[0][1] -= 650.0               # Cash and cash equivalents, beginning of period    -650.0
        expected_lines[16][1] -= 650.0              # Cash and cash equivalents, closing balance        -650.0

        # Init moves + reconciliation.
        moves = self.env['account.move'].create([
            {
                'date': '2015-08-01',
                'line_ids': [
                    (0, 0, {'debit': 3000.0, 'credit': 0.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 0.0, 'credit': 1000.0, 'account_id': other_account_2.id}),
                    (0, 0, {'debit': 0.0, 'credit': 2000.0, 'account_id': receivable_account_2.id}),
                ],
            },
            {
                'date': '2015-08-01',
                'line_ids': [
                    (0, 0, {'debit': 0.0, 'credit': 1500.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 500.0, 'credit': 0.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 1000.0, 'credit': 0.0, 'account_id': receivable_account_1.id}),
                ],
            },
        ])
        moves.post()

        liquidity_account.reconcile = True
        moves.mapped('line_ids')\
            .filtered(lambda line: line.account_id == liquidity_account)\
            .reconcile()

        options['date']['date_to'] = '2015-08-01'
        expected_lines[1][1] += 1500.0              # Net increase in cash and cash equivalents         1500.0
        expected_lines[2][1] += 1000.0              # Cash flows from operating activities              1000.0
        expected_lines[3][1] += 1000.0              # Advance Payments received from customers          1000.0
        expected_lines[10][1] += 1000.0             # Cash flows from financing activities              1000.0
        expected_lines[11][1] += 1000.0             # Cash in                                           1000.0
        expected_lines[13][1] -= 500.0              # Cash flows from unclassified activities           -500.0
        expected_lines[15][1] -= 500.0              # Cash out                                          -500.0
        expected_lines[16][1] += 1500.0             # Cash and cash equivalents, closing balance        850.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # Undo the reconciliation.
        moves.mapped('line_ids')\
            .filtered(lambda line: line.account_id == liquidity_account)\
            .remove_move_reconcile()
        liquidity_account.reconcile = False

        # ===================================================================================================
        # CASE 8:
        # Difficulties of these cases are:
        # - The liquidity moves are reconciled to moves having a total amount of 0.0.
        # - Double reconciliation between the liquidity and the misc moves.
        # - The reconciliations are partials.
        # - There are additional lines on the misc moves.
        #
        # Liquidity move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 1   | Bank            |           | 100     | 2015-09-01
        # 2   | Receivable 2    | 900       |         | 2015-09-01
        # 3   | other 1         |           | 400     | 2015-09-01
        # 4   | other 2         |           | 400     | 2015-09-01
        #
        # Misc move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 5   | other 1         | 500       |         | 2015-09-01
        # 6   | other 1         |           | 500     | 2015-09-01
        # 7   | other 2         | 500       |         | 2015-09-01
        # 8   | other 2         |           | 500     | 2015-09-01
        #
        # Reconciliation table (account.partial.reconcile):
        # Debit id    | Credit id     | Amount
        # ---------------------------------------------------
        # 5           | 3             | 400
        # 8           | 4             | 400
        # ===================================================================================================

        # Reset the report at 2015-09-01.
        options['date']['date_from'] = '2015-09-01'
        for line in expected_lines:
            line[1] = 0
        expected_lines[0][1] += 850.0               # Cash and cash equivalents, beginning of period    850.0
        expected_lines[16][1] += 850.0              # Cash and cash equivalents, closing balance        850.0

        # Init moves + reconciliation.
        moves = self.env['account.move'].create([
            {
                'date': '2015-09-01',
                'line_ids': [
                    (0, 0, {'debit': 0.0, 'credit': 100.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 900.0, 'credit': 0.0, 'account_id': receivable_account_2.id}),
                    (0, 0, {'debit': 0.0, 'credit': 400.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 0.0, 'credit': 400.0, 'account_id': other_account_2.id}),
                ],
            },
            {
                'date': '2015-09-01',
                'line_ids': [
                    (0, 0, {'debit': 500.0, 'credit': 0.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 0.0, 'credit': 500.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 500.0, 'credit': 0.0, 'account_id': other_account_2.id}),
                    (0, 0, {'debit': 0.0, 'credit': 500.0, 'account_id': other_account_2.id}),
                ],
            },
        ])
        moves.post()

        credit_line = moves[0].line_ids.filtered(lambda line: line.account_id == other_account_1)
        debit_line = moves[1].line_ids.filtered(lambda line: line.account_id == other_account_1 and line.debit > 0.0)
        (credit_line + debit_line).reconcile()

        credit_line = moves[0].line_ids.filtered(lambda line: line.account_id == other_account_2)
        debit_line = moves[1].line_ids.filtered(lambda line: line.account_id == other_account_2 and line.debit > 0.0)
        (credit_line + debit_line).reconcile()

        options['date']['date_to'] = '2015-09-01'
        expected_lines[1][1] -= 100.0               # Net increase in cash and cash equivalents         -100.0
        expected_lines[2][1] -= 900.0               # Cash flows from operating activities              -900.0
        expected_lines[3][1] -= 900.0               # Advance Payments received from customers          -900.0
        expected_lines[10][1] += 400.0              # Cash flows from financing activities              400.0
        expected_lines[11][1] += 400.0              # Cash in                                           400.0
        expected_lines[13][1] += 400.0              # Cash flows from unclassified activities           400.0
        expected_lines[14][1] += 400.0              # Cash in                                           400.0
        expected_lines[16][1] -= 100.0              # Cash and cash equivalents, closing balance        750.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

        # ===================================================================================================
        # CASE 9:
        # Same as case 8 but with inversed debit/credit.
        #
        # Liquidity move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 1   | Bank            | 100       |         | 2015-10-01
        # 2   | Receivable 2    |           | 900     | 2015-10-01
        # 3   | other 1         | 400       |         | 2015-10-01
        # 4   | other 2         | 400       |         | 2015-10-01
        #
        # Misc move 1:
        # Id  | Account         | Debit     | Credit  | Date
        # ---------------------------------------------------
        # 6   | other 1         |           | 500     | 2015-10-01
        # 5   | other 1         | 500       |         | 2015-10-01
        # 8   | other 2         |           | 500     | 2015-10-01
        # 7   | other 2         | 500       |         | 2015-10-01
        #
        # Reconciliation table (account.partial.reconcile):
        # Debit id    | Credit id     | Amount
        # ---------------------------------------------------
        # 5           | 3             | 400
        # 8           | 4             | 400
        # ===================================================================================================

        # Reset the report at 2015-10-01.
        options['date']['date_from'] = '2015-10-01'
        for line in expected_lines:
            line[1] = 0
        expected_lines[0][1] += 750.0               # Cash and cash equivalents, beginning of period    750.0
        expected_lines[16][1] += 750.0              # Cash and cash equivalents, closing balance        750.0

        # Init moves + reconciliation.
        moves = self.env['account.move'].create([
            {
                'date': '2015-10-01',
                'line_ids': [
                    (0, 0, {'debit': 100.0, 'credit': 0.0, 'account_id': liquidity_account.id}),
                    (0, 0, {'debit': 0.0, 'credit': 900.0, 'account_id': receivable_account_2.id}),
                    (0, 0, {'debit': 400.0, 'credit': 0.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 400.0, 'credit': 0.0, 'account_id': other_account_2.id}),
                ],
            },
            {
                'date': '2015-10-01',
                'line_ids': [
                    (0, 0, {'debit': 0.0, 'credit': 500.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 500.0, 'credit': 0.0, 'account_id': other_account_1.id}),
                    (0, 0, {'debit': 0.0, 'credit': 500.0, 'account_id': other_account_2.id}),
                    (0, 0, {'debit': 500.0, 'credit': 0.0, 'account_id': other_account_2.id}),
                ],
            },
        ])
        moves.post()

        credit_line = moves[1].line_ids.filtered(lambda line: line.account_id == other_account_1 and line.credit > 0.0)
        debit_line = moves[0].line_ids.filtered(lambda line: line.account_id == other_account_1)
        (credit_line + debit_line).reconcile()

        credit_line = moves[1].line_ids.filtered(lambda line: line.account_id == other_account_2 and line.credit > 0.0)
        debit_line = moves[0].line_ids.filtered(lambda line: line.account_id == other_account_2)
        (credit_line + debit_line).reconcile()

        options['date']['date_to'] = '2015-10-01'
        expected_lines[1][1] += 100.0               # Net increase in cash and cash equivalents         100.0
        expected_lines[2][1] += 900.0               # Cash flows from operating activities              900.0
        expected_lines[3][1] += 900.0               # Advance Payments received from customers          900.0
        expected_lines[10][1] -= 400.0              # Cash flows from financing activities              -400.0
        expected_lines[12][1] -= 400.0              # Cash out                                          -400.0
        expected_lines[13][1] -= 400.0              # Cash flows from unclassified activities           -400.0
        expected_lines[15][1] -= 400.0              # Cash out                                          -400.0
        expected_lines[16][1] += 100.0              # Cash and cash equivalents, closing balance        850.0
        assertCashFlowValues(report._get_lines(options), expected_lines)

    def test_cash_flow_statement_2_multi_company_currency(self):
        # Init report / options.
        report = self.env['account.cash.flow.report'].with_context(allowed_company_ids=(self.company_parent + self.company_child_eur).ids)
        options = self._init_options(report, *date_utils.get_month(fields.Date.from_string('2016-01-01')))

        journal_bank = self.env['account.journal'].search([('type', '=', 'bank'), ('company_id', '=', self.company_child_eur.id)], limit=1)
        account_receivable = self.env['account.account'].search([('user_type_id.type', '=', 'receivable'), ('company_id', '=', self.company_child_eur.id)], limit=1)
        account_revenue = self.env['account.account'].search([('user_type_id', '=', self.env.ref('account.data_account_type_revenue').id), ('company_id', '=', self.company_child_eur.id)], limit=1)

        invoice = self.env['account.move'].with_company(self.company_child_eur).create({
            'move_type': 'entry',
            'date': '2016-01-01',
            'line_ids': [
                (0, 0, {'debit': 1150.0,    'credit': 0.0,      'account_id': account_receivable.id}),
                (0, 0, {'debit': 0.0,       'credit': 1150.0,   'account_id': account_revenue.id}),
            ],
        })
        invoice.post()

        payment = self.env['account.move'].with_company(self.company_child_eur).create({
            'move_type': 'entry',
            'date': '2016-01-01',
            'journal_id': journal_bank.id,
            'line_ids': [
                (0, 0, {'debit': 0.0,       'credit': 230.0,    'account_id': account_receivable.id}),
                (0, 0, {'debit': 230.0,     'credit': 0.0,      'account_id': journal_bank.default_credit_account_id.id}),
            ],
        })
        payment.post()

        (invoice + payment).line_ids\
            .filtered(lambda line: line.account_id == account_receivable)\
            .reconcile()

        self.assertLinesValues(report._get_lines(options), [0, 1], [
            ['Cash and cash equivalents, beginning of period',                      0.0],
            ['Net increase in cash and cash equivalents',                           115.0],
            ['Cash flows from operating activities',                                115.0],
            ['Advance Payments received from customers',                            0.0],
            ['Cash received from operating activities',                             115.0],
            ['400000 Product Sales',                                                115.0],
            ['Total Cash received from operating activities',                       115.0],
            ['Advance payments made to suppliers',                                  0.0],
            ['Cash paid for operating activities',                                  0.0],
            ['Cash flows from investing & extraordinary activities',                0.0],
            ['Cash in',                                                             0.0],
            ['Cash out',                                                            0.0],
            ['Cash flows from financing activities',                                0.0],
            ['Cash in',                                                             0.0],
            ['Cash out',                                                            0.0],
            ['Cash flows from unclassified activities',                             0.0],
            ['Cash in',                                                             0.0],
            ['Cash out',                                                            0.0],
            ['Cash and cash equivalents, closing balance',                          115.0],
            ['101401 Bank',                                                         115.0],
            ['Total Cash and cash equivalents, closing balance',                    115.0],
        ])

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

    # -------------------------------------------------------------------------
    # TESTS: Consolidated Journals
    # -------------------------------------------------------------------------

    def test_consolidated_journals_folded_unfolded(self):
        ''' Test folded/unfolded lines. '''
        # Init options.
        report = self.env['account.consolidated.journal']
        options = self._init_options(report, *date_utils.get_quarter(self.mar_year_minus_1))
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Debit           Credit          Balance
            [   0,                                      1,              2,              3],
            [
                ('Customer Invoices (INV)',             1495.00,        1495.00,        0.00),
                ('Vendor Bills (BILL)',                 1265.00,        1265.00,        0.00),
                ('Bank (BNK1)',                         1600.00,        1600.00,        0.00),
                ('Total',                               4360.00,        4360.00,        0.00),
                ('',                                    '',             '',             ''),
                ('Details per month',                   '',             '',             ''),
                ('Jan 2017',                            1260.00,        1260.00,        0.00),
                ('Feb 2017',                            1220.00,        1220.00,        0.00),
                ('Mar 2017',                            1880.00,        1880.00,        0.00),
            ],
        )

        # Mark the 'Customer Invoices (INV)' line to be unfolded.
        line_id = lines[0]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options, line_id=line_id)
        self.assertLinesValues(
            lines,
            #   Name                                    Debit           Credit          Balance
            [   0,                                      1,              2,              3],
            [
                ('Customer Invoices (INV)',             1495.00,        1495.00,        0.00),
                ('121000 Account Receivable',           1495.00,        0.00,           1495.00),
                ('251000 Tax Received',                 0.00,           195.00,         -195.00),
                ('400000 Product Sales',                0.00,           1300.00,        -1300.00),
            ],
        )

        # Mark the '121000 Account Receivable' line to be unfolded.
        line_id = lines[1]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Debit           Credit          Balance
            [   0,                                      1,              2,              3],
            [
                ('Jan 2017',                            345.00,         0.00,           345.00),
                ('Feb 2017',                            460.00,         0.00,           460.00),
                ('Mar 2017',                            690.00,         0.00,           690.00),
            ],
        )

    def test_consolidated_journals_filter_journals(self):
        ''' Test folded/unfolded lines with a filter on journals. '''
        bank_journal = self.env['account.journal'].search([('company_id', '=', self.company_parent.id), ('type', '=', 'bank')])

        # Init options.
        report = self.env['account.consolidated.journal']
        options = self._init_options(report, *date_utils.get_quarter(self.mar_year_minus_1))
        options = self._update_multi_selector_filter(options, 'journals', bank_journal.ids)
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Debit           Credit          Balance
            [   0,                                      1,              2,              3],
            [
                ('Bank (BNK1)',                         1600.00,        1600.00,        0.00),
                ('Total',                               1600.00,        1600.00,        0.00),
                ('',                                    '',             '',             ''),
                ('Details per month',                   '',             '',             ''),
                ('Jan 2017',                            800.00,         800.00,         0.00),
                ('Feb 2017',                            300.00,         300.00,         0.00),
                ('Mar 2017',                            500.00,         500.00,         0.00),
            ],
        )

        # Mark the 'Bank (BNK1)' line to be unfolded.
        line_id = lines[0]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options, line_id=line_id)
        self.assertLinesValues(
            lines,
            #   Name                                        Debit           Credit          Balance
            [   0,                                          1,              2,              3],
            [
                ('Bank (BNK1)',                             1600.00,        1600.00,        0.00),
                ('101401 Bank',                             200.00,         50.00,          150.00),
                ('101402 Outstanding Receipts',             800.00,         100.00,         700.00),
                ('101403 Outstanding Payments',             50.00,          550.00,         -500.00),
                ('101702 Bank Suspense Account',            0.00,           100.00,         -100.00),
                ('121000 Account Receivable',               0.00,           800.00,         -800.00),
                ('211000 Account Payable',                  550.00,         0.00,           550.00),
            ],
        )

        # Mark the '121000 Account Receivable' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Debit           Credit          Balance
            [   0,                                      1,              2,              3],
            [
                ('Feb 2017',                            50.00,          250.00,         -200.00),
                ('Mar 2017',                            0.00,           300.00,         -300.00),
            ],
        )
