# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account_reports.tests.common import TestAccountReportsCommon
from odoo.tests import tagged
from odoo import fields


@tagged('post_install', '-at_install')
class LuxembourgElectronicReportTest(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_lu.lu_2011_chart_1'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.company_data['company'].ecdf_prefix = '1234AB'

        cls.out_invoice = cls.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2017-01-01',
            'invoice_line_ids': [
                (0, 0, {
                    'name': 'line_1',
                    'price_unit': 1000.0,
                    'quantity': 1.0,
                    'account_id': cls.company_data['default_account_revenue'].id,
                    'tax_ids': [(6, 0, cls.company_data['default_tax_sale'].ids)],
                }),
            ],
        })

        cls.in_invoice = cls.env['account.move'].create({
            'move_type': 'in_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2017-01-01',
            'invoice_line_ids': [
                (0, 0, {
                    'name': 'line_1',
                    'price_unit': 800.0,
                    'quantity': 1.0,
                    'account_id': cls.company_data['default_account_expense'].id,
                    'tax_ids': [(6, 0, cls.company_data['default_tax_purchase'].ids)],
                }),
            ],
        })

        (cls.out_invoice + cls.in_invoice).post()
    #
    def _filter_zero_lines(self, lines):
        filtered_lines = []
        for line in lines:
            balance_column = line['columns'][0]
            if 'no_format' not in balance_column or balance_column['no_format'] != 0.0:
                filtered_lines.append(line)
        return filtered_lines

    def test_balance_sheet(self):
        report = self.env.ref('l10n_lu_reports.account_financial_report_l10n_lu_bs')
        options = self._init_options(report, fields.Date.from_string('2017-01-01'), fields.Date.from_string('2017-12-31'))

        self.assertLinesValues(
            self._filter_zero_lines(report._get_table(options)[1]),
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('C. Fixed assets',                             -920.0),
                ('I. Intangible assets',                        -920.0),
                ('1. Costs of development',                     -920.0),
                ('Total I. Intangible assets',                  -920.0),
                ('Total C. Fixed assets',                       -920.0),
                ('TOTAL (ASSETS)',                              -920.0),
                ('A. Capital and reserves',                     -1070.0),
                ('III. Revaluation reserve',                    -1150.0),
                ('IV. Reserves',                                -120.0),
                ('1. Legal reserve',                            -120.0),
                ('Total IV. Reserves',                          -120.0),
                ('VI. Profit or loss for the financial year',   200.0),
                ('Total A. Capital and reserves',               -1070.0),
                ('TOTAL (CAPITAL, RESERVES AND LIABILITIES)',   -1070.0),
            ],
        )

    def test_profit_and_loss(self):
        report = self.env.ref('l10n_lu_reports.account_financial_report_l10n_lu_pl')
        options = self._init_options(report, fields.Date.from_string('2017-01-01'), fields.Date.from_string('2017-12-31'))

        self.assertLinesValues(
            self._filter_zero_lines(report._get_table(options)[1]),
            #   Name                                                                    Balance
            [   0,                                                                      1],
            [
                ('5. Raw materials and consumables and other external expenses',        -800.0),
                ('a) Raw materials and consumables',                                    -800.0),
                ('Total 5. Raw materials and consumables and other external expenses',  -800.0),
                ('16. Profit or loss after taxation',                                   -800.0),
                ('18. Profit or loss for the financial year',                           -800.0),
            ],
        )
