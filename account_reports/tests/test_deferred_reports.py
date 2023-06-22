# -*- coding: utf-8 -*-
# pylint: disable=C0326
from odoo.addons.account_reports.tests.common import TestAccountReportsCommon
from odoo import fields, Command
from odoo.exceptions import UserError
from odoo.tests import tagged, HttpCase


@tagged('post_install', '-at_install')
class TestDeferredReports(TestAccountReportsCommon, HttpCase):
    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.deferred_expense_report = cls.env.ref('account_reports.deferred_expense_report')
        cls.deferred_revenue_report = cls.env.ref('account_reports.deferred_revenue_report')

        cls.expense_accounts = [cls.env['account.account'].create({
            'name': f'Expense {i}',
            'code': f'EXP{i}',
            'account_type': 'expense',
        }) for i in range(3)]
        cls.revenue_accounts = [cls.env['account.account'].create({
            'name': f'Revenue {i}',
            'code': f'REV{i}',
            'account_type': 'income',
        }) for i in range(3)]

        cls.company = cls.company_data['company']
        cls.company.deferred_journal_id = cls.company_data['default_journal_misc'].id
        cls.company.deferred_expense_account_id = cls.company_data['default_account_deferred_expense'].id
        cls.company.deferred_revenue_account_id = cls.company_data['default_account_deferred_revenue'].id

        cls.expense_lines = [
            [cls.expense_accounts[0], 1000, '2023-01-01', '2023-04-30'],  # 4 full months (=250/month)
            [cls.expense_accounts[0], 1050, '2023-01-16', '2023-04-30'],  # 3 full months + 15 days (=300/month)
            [cls.expense_accounts[1], 1225, '2023-01-01', '2023-04-15'],  # 3 full months + 15 days (=350/month)
            [cls.expense_accounts[2], 1680, '2023-01-21', '2023-04-14'],  # 2 full months + 10 days + 14 days (=600/month)
            [cls.expense_accounts[2],  225, '2023-04-01', '2023-04-15'],  # 15 days (=450/month)
        ]
        cls.revenue_lines = [
            [cls.revenue_accounts[0], 1000, '2023-01-01', '2023-04-30'],  # 4 full months (=250/month)
            [cls.revenue_accounts[0], 1050, '2023-01-16', '2023-04-30'],  # 3 full months + 15 days (=300/month)
            [cls.revenue_accounts[1], 1225, '2023-01-01', '2023-04-15'],  # 3 full months + 15 days (=350/month)
            [cls.revenue_accounts[2], 1680, '2023-01-21', '2023-04-14'],  # 2 full months + 10 days + 14 days (=600/month)
            [cls.revenue_accounts[2],  225, '2023-04-01', '2023-04-15'],  # 15 days (=450/month)
        ]

    def create_invoice(self, move_type, journal, partner, invoice_lines, post=True):
        move = self.env['account.move'].create({
            'move_type': move_type,
            'partner_id': partner.id,
            'date': '2023-01-01',
            'invoice_date': '2023-01-01',
            'journal_id': journal.id,
            'invoice_line_ids': [
                Command.create({
                    'product_id': self.product_a.id,
                    'quantity': 1,
                    'account_id': invoice_line[0].id,
                    'price_unit': invoice_line[1],
                    'deferred_start_date': invoice_line[2],
                    'deferred_end_date': invoice_line[3],
                }) for invoice_line in invoice_lines
            ]
        })
        if post:
            move.action_post()
        return move

    def get_options(self, from_date, to_date, report=None):
        report = report or self.deferred_expense_report
        return self._generate_options(report, from_date, to_date)

    def test_deferred_expense_report_months(self):
        """
        Test the deferred expense report with the 'month' method.
        We use multiple report months/quarters/years to check that the computation is correct.
        """
        self.company.deferred_amount_computation_method = 'month'
        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, self.expense_lines)

        # December 2022
        options = self.get_options('2022-12-01', '2022-12-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name           Total               Before       Current              Later
            [   0,             1,                  2,           3,                   4                        ],
            [],
            options,
        )

        # January 2023
        options = self.get_options('2023-01-01', '2023-01-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before       Current              Later
            [   0,                  1,                  2,           3,                   4                        ],
            [
                ('EXP0 Expense 0',  1000 + 1050,        0.00,        250 + 150,           750 + 900                ),
                ('EXP1 Expense 1',  1225,               0.00,        350,                 875                      ),
                ('EXP2 Expense 2',  1680 + 0,           0.00,        600 * (10/30) + 0,   600 * (2 + 14/30) + 0    ),
                ('TOTALS',          4955,               0.00,        950,                 4005                     ),
            ],
            options,
        )

        # February 2023
        options = self.get_options('2023-02-01', '2023-02-28')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before               Current              Later
            [   0,                  1,                  2,                   3,                   4                        ],
            [
                ('EXP0 Expense 0',  1000 + 1050,        250 + 150,           250 + 300,           500 + 600                ),
                ('EXP1 Expense 1',  1225,               350,                 350,                 525                      ),
                ('EXP2 Expense 2',  1680 + 0,           600 * (10/30) + 0,   600 + 0,             600 * (1 + 14/30) + 0    ),
                ('TOTALS',          4955,               950,                 1500,                2505                     ),
            ],
            options,
        )

        # April 2023
        options = self.get_options('2023-04-01', '2023-04-30')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before                       Current                 Later
            [   0,                  1,                  2,                           3,                      4     ],
            [
                ('EXP0 Expense 0',  1000 + 1050,        750 + 750,                   250 + 300,              0.0   ),
                ('EXP1 Expense 1',  1225,               1050,                        175,                    0.0   ),
                ('EXP2 Expense 2',  1680 + 225,         600 * (2 + 10/30) + 0,       600 * (14/30) + 225,    0.0   ),
                ('TOTALS',          5180,               3950,                        1230,                   0.0   ),
            ],
            options,
        )

        # May 2023
        options = self.get_options('2023-05-01', '2023-05-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name           Total               Before                       Current                 Later
            [   0,             1,                  2,                           3,                      4     ],
            [],
            options,
        )

        # Q1 2023
        options = self.get_options('2023-01-01', '2023-03-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before       Current                 Later
            [   0,                  1,                  2,           3,                      4     ],
            [
                ('EXP0 Expense 0',  1000 + 1050,        0.0,         750 + 750,              550   ),
                ('EXP1 Expense 1',  1225,               0.0,         1050,                   175   ),
                ('EXP2 Expense 2',  1680 + 0,           0.0,         600 * (2 + 10/30) + 0,  280   ),
                ('TOTALS',          4955,               0.0,         3950,                   1005  ),
            ],
            options,
        )

        # Q2 2023
        options = self.get_options('2023-04-01', '2023-06-30')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before                       Current                 Later
            [   0,                  1,                  2,                           3,                      4     ],
            [
                ('EXP0 Expense 0',  1000 + 1050,        750 + 750,                   250 + 300,              0.0   ),
                ('EXP1 Expense 1',  1225,               1050,                        175,                    0.0   ),
                ('EXP2 Expense 2',  1680 + 225,         600 * (2 + 10/30) + 0,       600 * (14/30) + 225,    0.0   ),
                ('TOTALS',          5180,               3950,                        1230,                   0.0   ),
            ],
            options,
        )

        # 2022
        options = self.get_options('2022-01-01', '2022-12-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name           Total               Before                       Current                 Later
            [   0,             1,                  2,                           3,                      4     ],
            [],
            options,
        )

        # 2023
        options = self.get_options('2023-01-01', '2023-12-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total            Before      Current         Later
            [   0,                  1,               2,          3,              4     ],
            [
                ('EXP0 Expense 0',  1000 + 1050,     0.0,        1000 + 1050,    0.0   ),
                ('EXP1 Expense 1',  1225,            0.0,        1225,           0.0   ),
                ('EXP2 Expense 2',  1680 + 225,      0.0,        1680 + 225,     0.0   ),
                ('TOTALS',          5180,            0.0,        5180,           0.0   ),
            ],
            options,
        )

    def test_deferred_revenue_report(self):
        """
        Test the deferred revenue report with the 'month' method.
        We use multiple report months/quarters/years to check that the computation is correct.
        """
        self.company.deferred_amount_computation_method = 'month'
        self.create_invoice('out_invoice', self.company_data['default_journal_sale'], self.partner_a, self.revenue_lines)

        # December 2022
        options = self.get_options('2022-12-01', '2022-12-31', self.deferred_revenue_report)
        lines = self.deferred_revenue_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name           Total               Before       Current              Later
            [   0,             1,                  2,           3,                   4       ],
            [],
            options,
        )

        # January 2023
        options = self.get_options('2023-01-01', '2023-01-31', self.deferred_revenue_report)
        lines = self.deferred_revenue_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before       Current              Later
            [   0,                  1,                  2,           3,                   4                        ],
            [
                ('REV0 Revenue 0',  1000 + 1050,        0.0,         250 + 150,           750 + 900                ),
                ('REV1 Revenue 1',  1225,               0.0,         350,                 875                      ),
                ('REV2 Revenue 2',  1680 + 0,           0.0,         600 * (10/30) + 0,   600 * (2 + 14/30) + 0    ),
                ('TOTALS',          4955,               0.0,         950,                 4005                     ),
            ],
            options,
        )

        # February 2023
        options = self.get_options('2023-02-01', '2023-02-28', self.deferred_revenue_report)
        lines = self.deferred_revenue_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before               Current              Later
            [   0,                  1,                  2,                   3,                   4                        ],
            [
                ('REV0 Revenue 0',  1000 + 1050,        250 + 150,           250 + 300,           500 + 600                ),
                ('REV1 Revenue 1',  1225,               350,                 350,                 525                      ),
                ('REV2 Revenue 2',  1680 + 0,           600 * (10/30) + 0,   600 + 0,             600 * (1 + 14/30) + 0    ),
                ('TOTALS',          4955,               950,                 1500,                2505                     ),
            ],
            options,
        )

        # April 2023
        options = self.get_options('2023-04-01', '2023-04-30', self.deferred_revenue_report)
        lines = self.deferred_revenue_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before                       Current                 Later
            [   0,                  1,                  2,                           3,                      4     ],
            [
                ('REV0 Revenue 0',  1000 + 1050,        750 + 750,                   250 + 300,              0.0   ),
                ('REV1 Revenue 1',  1225,               1050,                        175,                    0.0   ),
                ('REV2 Revenue 2',  1680 + 225,         600 * (2 + 10/30) + 0,       600 * (14/30) + 225,    0.0   ),
                ('TOTALS',          5180,               3950,                        1230,                   0.0   ),
            ],
            options,
        )

        # May 2023
        options = self.get_options('2023-05-01', '2023-05-31', self.deferred_revenue_report)
        lines = self.deferred_revenue_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name           Total               Before                       Current                 Later
            [   0,             1,                  2,                           3,                      4     ],
            [],
            options,
        )

        # Q1 2023
        options = self.get_options('2023-01-01', '2023-03-31', self.deferred_revenue_report)
        lines = self.deferred_revenue_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before       Current                 Later
            [   0,                  1,                  2,           3,                      4     ],
            [
                ('REV0 Revenue 0',  1000 + 1050,        0.0,         750 + 750,              550   ),
                ('REV1 Revenue 1',  1225,               0.0,         1050,                   175   ),
                ('REV2 Revenue 2',  1680 + 0,           0.0,         600 * (2 + 10/30) + 0,  280   ),
                ('TOTALS',          4955,               0.0,         3950,                   1005  ),
            ],
            options,
        )

        # Q2 2023
        options = self.get_options('2023-04-01', '2023-06-30', self.deferred_revenue_report)
        lines = self.deferred_revenue_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before                       Current                 Later
            [   0,                  1,                  2,                           3,                      4     ],
            [
                ('REV0 Revenue 0',  1000 + 1050,        750 + 750,                   250 + 300,              0.0   ),
                ('REV1 Revenue 1',  1225,               1050,                        175,                    0.0   ),
                ('REV2 Revenue 2',  1680 + 225,         600 * (2 + 10/30) + 0,       600 * (14/30) + 225,    0.0   ),
                ('TOTALS',          5180,               3950,                        1230,                   0.0   ),
            ],
            options,
        )

        # 2022
        options = self.get_options('2022-01-01', '2022-12-31', self.deferred_revenue_report)
        lines = self.deferred_revenue_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name           Total               Before                       Current                 Later
            [   0,             1,                  2,                           3,                      4     ],
            [],
            options,
        )

        # 2023
        options = self.get_options('2023-01-01', '2023-12-31', self.deferred_revenue_report)
        lines = self.deferred_revenue_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total            Before      Current         Later
            [   0,                  1,               2,          3,              4     ],
            [
                ('REV0 Revenue 0',  1000 + 1050,     0.0,        1000 + 1050,    0.0   ),
                ('REV1 Revenue 1',  1225,            0.0,        1225,           0.0   ),
                ('REV2 Revenue 2',  1680 + 225,      0.0,        1680 + 225,     0.0   ),
                ('TOTALS',          5180,            0.0,        5180,           0.0   ),
            ],
            options,
        )

    def test_deferred_expense_report_days(self):
        """
        Test the deferred expense report with the 'day' method.
        We use multiple report months/quarters/years to check that the computation is correct.
        """
        self.company.deferred_amount_computation_method = 'day'
        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, self.expense_lines)

        # December 2022
        options = self.get_options('2022-12-01', '2022-12-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name           Total               Before       Current     Later
            [   0,             1,                  2,           3,          4       ],
            [],
            options,
        )

        # January 2023
        options = self.get_options('2023-01-01', '2023-01-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before       Current     Later
            [   0,                  1,                  2,           3,          4       ],
            [
                ('EXP0 Expense 0',  1000 + 1050,        0.0,         418.33,     1631.67 ),
                ('EXP1 Expense 1',  1225,               0.0,         361.67,     863.33  ),
                ('EXP2 Expense 2',  1680 + 0,           0.0,         220,        1460    ),
                ('TOTALS',          4955,               0.0,         1000,       3955    ),
            ],
            options,
        )

        # February 2023
        options = self.get_options('2023-02-01', '2023-02-28')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before       Current     Later
            [   0,                  1,                  2,           3,          4       ],
            [
                ('EXP0 Expense 0',  1000 + 1050,        418.33,      513.33,     1118.33 ),
                ('EXP1 Expense 1',  1225,               361.67,      326.67,     536.67  ),
                ('EXP2 Expense 2',  1680 + 0,           220,         560,        900     ),
                ('TOTALS',          4955,               1000,        1400,       2555    ),
            ],
            options,
        )

        # Q1 2023
        options = self.get_options('2023-01-01', '2023-03-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before       Current     Later
            [   0,                  1,                  2,           3,          4       ],
            [
                ('EXP0 Expense 0',  1000 + 1050,        0.0,         1500,       550     ),
                ('EXP1 Expense 1',  1225,               0.0,         1050,       175     ),
                ('EXP2 Expense 2',  1680 + 0,           0.0,         1400,       280     ),
                ('TOTALS',          4955,               0.0,         3950,       1005    ),
            ],
            options,
        )

    def test_deferred_expense_report_filter_all_entries(self):
        """
        Test the 'All entries' option on the deferred expense report.
        """
        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, self.expense_lines, post=True)
        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, self.expense_lines, post=False)

        # Only posted entries
        options = self.get_options('2023-02-01', '2023-02-28')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
                lines,
                #   Name                Total               Before       Current     Later
                [   0,                  1,                  2,           3,          4       ],
                [
                    ('EXP0 Expense 0',  1000 + 1050,        418.33,      513.33,     1118.33 ),
                    ('EXP1 Expense 1',  1225,               361.67,      326.67,     536.67  ),
                    ('EXP2 Expense 2',  1680 + 0,           220,         560,        900     ),
                    ('TOTALS',          4955,               1000,        1400,       2555    ),
                ],
                options,
            )

        # All non-cancelled entries
        options = self._generate_options(self.deferred_expense_report, fields.Date.from_string('2023-02-01'), fields.Date.from_string('2023-02-28'), {
            'all_entries': True,
        })
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total               Before       Current     Later
            [   0,                  1,                  2,           3,          4       ],
            [
                ('EXP0 Expense 0',  2000 + 2100,        836.67,      1026.67,    2236.67 ),
                ('EXP1 Expense 1',  2450,               723.33,      653.33,     1073.33 ),
                ('EXP2 Expense 2',  3360 + 0,           440,         1120,       1800    ),
                ('TOTALS',          9910,               2000,        2800,       5110    ),
            ],
            options,
        )

    def test_deferred_expense_report_comparison(self):
        """
        Test the the comparison tool on the deferred expense report.
        For instance, we select April 2023 and compare it with the last 4 months
        """
        self.company.deferred_amount_computation_method = 'month'
        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, self.expense_lines)

        # April 2023 + period comparison of last 4 months
        options = self.get_options('2023-04-01', '2023-04-30')
        options = self._update_comparison_filter(options, self.deferred_expense_report, 'previous_period', 4)
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total    Before      Dec 2022    Jan 2023    Feb 2023    Mar 2023    Apr 2023 (Current)  Later
            [   0,                  1,       2,          3,          4,          5,          6,          7,                  8,      ],
            [
                ('EXP0 Expense 0',  2050,    0.0,        0.0,        400,        550,        550,        550,                0.0     ),
                ('EXP1 Expense 1',  1225,    0.0,        0.0,        350,        350,        350,        175,                0.0     ),
                ('EXP2 Expense 2',  1905,    0.0,        0.0,        200,        600,        600,        505,                0.0     ),
                ('TOTALS',          5180,    0.0,        0.0,        950,        1500,       1500,       1230,               0.0     ),
            ],
            options,
        )

    def test_deferred_expense_report_partially_deductible_tax(self):
        """
        Test the deferred expense report with partially deductible tax.
        If we have 50% deductible tax, half of the invoice line amount should also be deferred.
        Here, for an invoice line of 1000, and a tax of 40% partially deductible (50%) on 3 months, we will have:
        - 1400 for the total amount, tax included
        - 1200 for the total amount to be deferred (1000 + 400/2)
        - 400 for the deferred amount for each of the 3 months
        """
        self.company.deferred_amount_computation_method = 'month'
        move = self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, [], post=False)
        partially_deductible_tax = self.env['account.tax'].create({
            'name': 'Partially deductible Tax',
            'amount': 40,
            'amount_type': 'percent',
            'type_tax_use': 'purchase',
            'invoice_repartition_line_ids': [
                Command.create({'repartition_type': 'base'}),
                Command.create({
                    'factor_percent': 50,
                    'repartition_type': 'tax',
                    'use_in_tax_closing': False
                }),
                Command.create({
                    'factor_percent': 50,
                    'repartition_type': 'tax',
                    'account_id': self.company_data['default_account_tax_purchase'].id,
                    'use_in_tax_closing': True
                }),
            ],
            'refund_repartition_line_ids': [
                Command.create({'repartition_type': 'base'}),
                Command.create({
                    'factor_percent': 50,
                    'repartition_type': 'tax',
                    'use_in_tax_closing': False
                }),
                Command.create({
                    'factor_percent': 50,
                    'repartition_type': 'tax',
                    'account_id': self.company_data['default_account_tax_purchase'].id,
                    'use_in_tax_closing': True
                }),
            ],
        })
        move.invoice_line_ids += self.env['account.move.line'].new({
            'name': 'Partially deductible line',
            'quantity': 1,
            'price_unit': 1000,
            'tax_ids': [Command.set(partially_deductible_tax.ids)],
            'account_id': self.expense_accounts[0].id,
            'deferred_start_date': '2023-01-01',
            'deferred_end_date': '2023-03-31',
        })
        move.action_post()

        options = self.get_options('2023-02-01', '2023-02-28')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total        Before      Current     Later
            [   0,                  1,           2,          3,          4       ],
            [
                ('EXP0 Expense 0',  1200,        400,        400,        400     ),
                ('TOTALS',          1200,        400,        400,        400     ),
            ],
            options,
        )

    def test_deferred_expense_report_credit_notes(self):
        """
        Test the credit notes on the deferred expense report.
        """
        self.create_invoice('in_refund', self.company_data['default_journal_purchase'], self.partner_a, self.expense_lines)

        options = self.get_options('2023-02-01', '2023-02-28')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total                Before        Current      Later
            [   0,                  1,                   2,            3,           4        ],
            [
                ('EXP0 Expense 0',  -1000 - 1050,        -418.33,      -513.33,     -1118.33 ),
                ('EXP1 Expense 1',  -1225,               -361.67,      -326.67,     -536.67  ),
                ('EXP2 Expense 2',  -1680 - 0,           -220,         -560,        -900     ),
                ('TOTALS',          -4955,               -1000,        -1400,       -2555    ),
            ],
            options,
        )

    def assert_invoice_lines(self, deferred_move, expected_values):
        for line, expected_value in zip(deferred_move.line_ids, expected_values):
            expected_account, expected_debit, expected_credit = expected_value
            self.assertRecordValues(line, [{
                'account_id': expected_account.id,
                'debit': expected_debit,
                'credit': expected_credit,
            }])

    def test_deferred_expense_report_accounting_date(self):
        """
        Test that the accounting date is taken into account for the deferred expense report.
        """
        self.company.deferred_amount_computation_method = 'month'
        self.company.generate_deferred_entries_method = 'manual'
        handler = self.env['account.deferred.expense.report.handler']
        move = self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, [self.expense_lines[0]], post=False)
        move.date = '2023-02-15'
        move.action_post()

        # In january, the move is not accounted yet (accounting date is in 15 Feb), so nothing should be displayed.
        options = self.get_options('2023-01-01', '2023-01-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name       Total        Before      Current     Later
            [   0,         1,           2,          3,          4       ],
            [],
            options,
        )
        # Nothing should be generated either.
        with self.assertRaisesRegex(UserError, 'No entry to generate.'):
            handler.action_generate_entry(options)

        # In Feb, the move is accounted, so it should be displayed.
        options = self.get_options('2023-02-01', '2023-02-28')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total        Before      Current     Later
            [   0,                  1,           2,          3,          4       ],
            [
                ('EXP0 Expense 0',  1000,        250,        250,        500     ),
                ('TOTALS',          1000,        250,        250,        500     ),
            ],
            options,
        )

        # Same in March.
        options = self.get_options('2023-03-01', '2023-03-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total        Before      Current     Later
            [   0,                  1,           2,          3,          4       ],
            [
                ('EXP0 Expense 0',  1000,        500,        250,        250     ),
                ('TOTALS',          1000,        500,        250,        250     ),
            ],
            options,
        )

        # Same in April.
        options = self.get_options('2023-04-01', '2023-04-30')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total        Before      Current     Later
            [   0,                  1,           2,          3,          4     ],
            [
                ('EXP0 Expense 0',  1000,        750,        250,        0     ),
                ('TOTALS',          1000,        750,        250,        0     ),
            ],
            options,
        )

        # In May, the move is accounted and fully deferred, so it should not be displayed.
        options = self.get_options('2023-05-01', '2023-05-31')
        lines = self.deferred_expense_report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                Total        Before      Current     Later
            [   0,                  1,           2,          3,          4     ],
            [],
            options,
        )

    def test_deferred_expense_generate_grouped_entries_method(self):
        """
        Test the Generate entries button on the deferred expense report.
        """
        self.company.deferred_amount_computation_method = 'month'
        self.company.generate_deferred_entries_method = 'manual'
        deferral_account = self.company_data['default_account_deferred_expense']

        options = self.get_options('2023-01-01', '2023-01-31')

        handler = self.env['account.deferred.expense.report.handler']
        with self.assertRaisesRegex(UserError, 'No entry to generate.'):
            handler.action_generate_entry(options)

        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, [self.expense_lines[0]], post=True)
        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, [self.expense_lines[1]], post=True)
        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_b, [self.expense_lines[2]], post=True)

        # Check that no deferred move has been created
        self.assertEqual(self.env['account.move.line'].search_count([('account_id', '=', deferral_account.id)]), 0)

        # Generate the grouped deferred entries
        res = handler.action_generate_entry(options)
        generated_entries_january = self.env['account.move'].search(res['domain'], order='date')

        deferred_move_january = generated_entries_january[0]
        self.assertRecordValues(deferred_move_january, [{
            'state': 'posted',
            'move_type': 'entry',
            'date': fields.Date.to_date('2023-01-31'),
        }])
        expected_values_january = [
            #          Date                         Debit                       Credit
            [self.expense_accounts[0],                                     0, 1000 + 1050],
            [self.expense_accounts[0],                             250 + 150,           0],
            [self.expense_accounts[1],                                     0,        1225],
            [self.expense_accounts[1],                                   350,           0],
            [deferral_account,          1000 + 1050 + 1225 - 250 - 150 - 350,           0]
        ]
        self.assert_invoice_lines(deferred_move_january, expected_values_january)

        deferred_inverse_january = generated_entries_january[1]
        self.assertEqual(deferred_inverse_january.move_type, 'entry')
        self.assertEqual(deferred_inverse_january.state, 'posted')  # Posted because the date is before today
        self.assertEqual(deferred_inverse_january.date, fields.Date.from_string('2023-02-01'))

        # Don't re-generate entries for the same period if they already exist for all move lines
        with self.assertRaisesRegex(UserError, 'No entry to generate.'):
            handler.action_generate_entry(options)

        # Generate the grouped deferred entries for the next period
        res = handler.action_generate_entry(self.get_options('2023-02-01', '2023-02-28'))
        generated_entries_february = self.env['account.move'].search(res['domain'], order='date')
        deferred_move_february = generated_entries_february[0]
        expected_values_february = [
            #          Date                         Debit                       Credit
            [self.expense_accounts[0],                                     0, 1000 + 1050],
            [self.expense_accounts[0],                             500 + 450,           0],
            [self.expense_accounts[1],                                     0,        1225],
            [self.expense_accounts[1],                                   700,           0],
            [deferral_account,          1000 + 1050 + 1225 - 500 - 450 - 700,           0]
        ]
        self.assert_invoice_lines(deferred_move_february, expected_values_february)

    def test_deferred_values_rounding(self):
        """
        When using the manually & grouped method, we might have some rounding issues
        when aggregating multiple deferred entries. This test ensures that the rounding
        is done correctly.
        """
        self.company.generate_deferred_entries_method = 'manual'
        self.company.deferred_amount_computation_method = 'day'
        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, [[self.expense_accounts[0], 600, '2023-04-04', '2023-05-25']], post=True)
        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, [[self.expense_accounts[1], 600, '2023-04-05', '2023-05-16']], post=True)
        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, [[self.expense_accounts[0], 600, '2023-04-04', '2023-05-08']], post=True)

        handler = self.env['account.deferred.expense.report.handler']
        # This shouldn't raise an error like this 'The total of debits equals $1,800.01 and the total of credits equals $1,800.00.'
        handler.action_generate_entry(self.get_options('2023-04-01', '2023-04-30'))

    def test_deferred_expense_change_grouped_entries_method(self):
        """
        Test the change of the deferred expense method from on_validation to manual
        """
        self.company.deferred_amount_computation_method = 'month'
        self.company.generate_deferred_entries_method = 'on_validation'
        deferral_account = self.company_data['default_account_deferred_expense']

        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, [self.expense_lines[0]], post=True)
        self.assertEqual(self.env['account.move.line'].search_count([('account_id', '=', deferral_account.id)]), 5)  # 4 months + 1 for the initial deferred invoice

        # When changing the method to manual, the deferred entries should not be re-generated
        self.company.generate_deferred_entries_method = 'manual'
        handler = self.env['account.deferred.expense.report.handler']
        with self.assertRaisesRegex(UserError, 'No entry to generate.'):
            handler.action_generate_entry(self.get_options('2023-02-01', '2023-02-28'))

    def test_deferred_expense_manual_generation_totally_defered(self):
        """
        In manual mode generation, if the lines are totally deferred,
        then no entry should be generated.
        """
        self.company.deferred_amount_computation_method = 'month'
        self.company.generate_deferred_entries_method = 'manual'
        deferral_account = self.company_data['default_account_deferred_expense']
        handler = self.env['account.deferred.expense.report.handler']

        self.create_invoice('in_invoice', self.company_data['default_journal_purchase'], self.partner_a, [self.expense_lines[0]])
        handler.action_generate_entry(self.get_options('2023-03-01', '2023-03-31'))
        self.assertEqual(self.env['account.move.line'].search_count([('account_id', '=', deferral_account.id)]), 2)

        with self.assertRaisesRegex(UserError, 'No entry to generate.'):
            handler.action_generate_entry(self.get_options('2023-04-01', '2023-04-30'))
