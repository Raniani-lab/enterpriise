# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account_reports.tests.common import TestAccountReportsCommon
from odoo.tests import tagged
from odoo import fields


@tagged('post_install_l10n', 'post_install', '-at_install')
class LuxembourgElectronicReportTest(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_lu.lu_2011_chart_1'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.company_data['company'].write({
            'ecdf_prefix': '1234AB',
            'vat': 'LU12345613',
        })

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

        (cls.out_invoice + cls.in_invoice).action_post()
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
                ('D. Current assets',                           1306.0),
                ('II. Debtors',                                 1306.0),
                ('1. Trade debtors',                            1170.0),
                ('a) becoming due and payable within one year', 1170.0),
                ('4. Other debtors',                            136.0),
                ('a) becoming due and payable within one year', 136.0),
                ('TOTAL (ASSETS)',                              1306.0),
                ('A. Capital and reserves',                      200.0),
                ('VI. Profit or loss for the financial year',    200.0),
                ('C. Creditors',                                 1106.0),
                ('4. Trade creditors',                           936.0),
                ('a) becoming due and payable within one year',  936.0),
                ('8. Other creditors',                           170.0),
                ('a) Tax authorities',                           170.0),
                ('TOTAL (CAPITAL, RESERVES AND LIABILITIES)',    1306.0),
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
                ('1. Net turnover',                                                     1000.0),
                ('5. Raw materials and consumables and other external expenses',        -800.0),
                ('a) Raw materials and consumables',                                    -800.0),
                ('16. Profit or loss after taxation',                                    200.0),
                ('18. Profit or loss for the financial year',                            200.0),
            ],
        )
