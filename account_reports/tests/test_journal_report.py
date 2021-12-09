# -*- coding: utf-8 -*-
# pylint: disable=C0326
from .common import TestAccountReportsCommon

from odoo import Command, fields
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestJournalAuditReport(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        ##############
        # Bank entries
        ##############

        # Entries in 2016 for company_1 to test the starting balance of bank journals.
        liquidity_account = cls.company_data['default_journal_bank'].default_account_id
        cls.move_2016_1 = cls.env['account.move'].create({
            'move_type': 'entry',
            'date': '2016-01-01',
            'journal_id': cls.company_data['default_journal_bank'].id,
            'line_ids': [
                Command.create({'debit': 100.0,     'credit': 0.0,      'name': '2016_1_1',     'account_id': liquidity_account.id}),
                Command.create({'debit': 0.0,       'credit': 100.0,    'name': '2016_1_2',     'account_id': cls.company_data['default_account_revenue'].id}),
            ],
        })
        cls.move_2016_1.action_post()

        # Entries in 2017 for company_1 to test the bank journal at current date.
        cls.move_2017_1 = cls.env['account.move'].create({
            'move_type': 'entry',
            'date': '2017-01-01',
            'journal_id': cls.company_data['default_journal_bank'].id,
            'line_ids': [
                Command.create({'debit': 200.0,     'credit': 0.0,      'name': '2017_1_1',     'account_id': liquidity_account.id}),
                Command.create({'debit': 0.0,     'credit': 200.0,      'name': '2017_1_2',     'account_id': cls.company_data['default_account_revenue'].id}),
            ],
        })
        cls.move_2017_1.action_post()

        ##############
        # Sales entries
        ##############

        # Invoice in 2017 for company_1 to test a sale journal at current date.
        cls.move_2017_2 = cls.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2017-01-01',
            'journal_id': cls.company_data['default_journal_sale'].id,
            'payment_reference': 'ref123',
            'invoice_line_ids': [Command.create({
                'quantity': 1,
                'price_unit': 3000.0,
                'account_id': cls.company_data['default_account_revenue'].id,
                'tax_ids': [],
            })],
        })
        cls.move_2017_2.action_post()

        # Invoice in 2017 for company_1, with foreign currency to test a sale journal at current date.
        cls.currency_data_2 = cls.setup_multi_currency_data({
            'name': 'Dark Chocolate Coin',
            'symbol': '🍫',
            'currency_unit_label': 'Dark Choco',
            'currency_subunit_label': 'Dark Cacao Powder',
        }, rate2016=2.0, rate2017=2.0)
        cls.move_2017_3 = cls.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2017-01-01',
            'journal_id': cls.company_data['default_journal_sale'].id,
            'currency_id': cls.currency_data_2['currency'].id,
            'payment_reference': 'ref234',
            'invoice_line_ids': [Command.create({
                'quantity': 1,
                'price_unit': 3000.0,
                'account_id': cls.company_data['default_account_revenue'].id,
                'tax_ids': [],
            })],
        })
        cls.move_2017_3.action_post()

        # Invoice in 2017 for company_1, with foreign currency but no ref.
        cls.move_2017_4 = cls.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2017-01-01',
            'journal_id': cls.company_data['default_journal_sale'].id,
            'currency_id': cls.currency_data_2['currency'].id,
            'invoice_line_ids': [Command.create({
                'quantity': 1,
                'price_unit': 2000.0,
                'account_id': cls.company_data['default_account_revenue'].id,
                'tax_ids': [],
            })],
        })
        cls.move_2017_4.action_post()
        cls.move_2017_4.payment_reference = ''

        ####
        # Setup a tax report, tax report line, and all needed to get a tax with a grid.
        ####

        cls.company_data['company'].country_id = cls.env.ref('base.us')
        cls.tax_report = cls.env['account.tax.report'].create({
            'name': "Tax report",
            'country_id': cls.company_data['company'].country_id.id,
        })
        # Used to get a tag generated for the tax.
        tax_report_line = cls.env['account.tax.report.line'].create({
            'name': '10%',
            'code': 'c10',
            'report_id': cls.tax_report.id,
            'tag_name': 'c10',
            'sequence': 10,
        })
        cls.test_tax = cls.env['account.tax'].create({
            'name': 'Tax 10%',
            'amount': 10.0,
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'invoice_repartition_line_ids': [
                Command.create({
                    'factor_percent': 100,
                    'repartition_type': 'base',
                }),
                Command.create({
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'tag_ids': [Command.link(tax_report_line.tag_ids.filtered(lambda x: not x.tax_negate).id)],
                })]
        })
        # Invoice in 2017 for company_1, with taxes
        cls.move_2017_5 = cls.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2017-01-01',
            'payment_reference': 'ref345',
            'journal_id': cls.company_data['default_journal_sale'].id,
            'invoice_line_ids': [Command.create({
                'quantity': 1,
                'price_unit': 1500.0,
                'account_id': cls.company_data['default_account_revenue'].id,
                'tax_ids': [cls.test_tax.id],
            })],
        })
        cls.move_2017_5.action_post()

    def test_report_journal_sale_journal(self):
        report = self.env['account.journal.audit']
        options = self._init_options(report, fields.Date.from_string('2017-01-01'), fields.Date.from_string('2017-01-31'))

        # The first journal is unfolded by default
        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                    Account                   Debit           Credit         Taxes               Tax grids
            [   0,                                      1,                        3,              4,             5,                  6],
            [
                ('Customer Invoices (INV)',             '',                       '',             '',            '',                 ''),
                ('Name',                                'Account',                'Debit',        'Credit',      'Taxes',            'Tax Grids'),
                ('INV/2017/00001',                      '121000 ',                3000.0,         '',            '',                 ''),
                ('ref123',                              '400000 Product Sales',   '',             3000.0,        '',                 ''),
                ('INV/2017/00002',                      '121000 ',                1500.0,         '',            '',                 ''),
                ('ref234',                              '400000 Product Sales',   '',             1500.0,        '',                 ''),
                # Because there is a payment_reference, we need to add a line for the amount in currency
                ('Amount in currency: 3,000.000\xa0🍫', '',                       '',             '',            '',                 ''),
                ('INV/2017/00003',                      '121000 ',                1000.0,         '',            '',                 ''),
                # No payment_reference, so the amount in currency is added in the name of the second line.
                ('Amount in currency: 2,000.000\xa0🍫', '400000 Product Sales',   '',             1000.0,        '',                 ''),
                # Invoice with taxes
                ('INV/2017/00004',                      '121000 ',                1650.0,         '',            '',                 ''),
                ('ref345',                              '400000 Product Sales',   '',             1500.0,        'T: Tax 10%',       ''),
                ('',                                    '400000 Product Sales',   '',             150.0,         'B: $\xa01,500.00', '+c10'),
                # This is the tax summary line, it's rendered in a custom way and don't have values in the name/columns
                ('',                                    '',                       '',             '',            '',                 ''),
                ('Bank (BNK1)',                         '',                       '',             '',            '',                 ''),
            ],
        )

    def test_report_journal_bank_journal(self):
        report = self.env['account.journal.audit']
        line_id = '-account.journal-%s' % self.company_data['default_journal_bank'].id
        options = self._init_options(report, fields.Date.from_string('2017-01-01'), fields.Date.from_string('2017-01-31'))
        options['unfolded_lines'] = [line_id]

        # The first journal is unfolded by default
        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                    Account                   Debit           Credit                Balance             Tax grids
            [   0,                                      1,                        3,              4,                    5,                  6],
            [
                ('Customer Invoices (INV)',             '',                       '',             '',                   '',                 ''),
                ('Bank (BNK1)',                         '',                       '',             '',                   '',                 ''),
                ('Name',                                'Account',                'Debit',        'Credit',             'Balance',          ''),
                ('',                                    '',                       '',             'Starting Balance :', 100.00,             ''),
                ('BNK1/2017/01/0001',                   '400000 Product Sales',   '',             200.00,               300.00,             ''),
                ('',                                    '',                       '',             'Ending Balance :',   300.00,             ''),
            ],
        )
