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
