# -*- coding: utf-8 -*-
from unittest.mock import patch

from .common import TestAccountReportsCommon
from odoo import fields
from odoo.tests.common import Form


class TestTaxReport(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.tax_account = cls.env['account.account'].create({
            'name': 'tax_account',
            'code': 'taxtax',
            'user_type_id': cls.env.ref('account.data_account_type_current_liabilities').id,
            'company_id': cls.company_data['company'].id,
        })

        cls.tax_group_sale = cls.env['account.tax.group'].create({
            'name': 'tax_group_sale',
            'property_tax_receivable_account_id': cls.company_data['default_account_receivable'].copy().id,
            'property_tax_payable_account_id': cls.company_data['default_account_payable'].copy().id,
        })
        cls.tax_group_purchase = cls.env['account.tax.group'].create({
            'name': 'tax_group_purchase',
            'property_tax_receivable_account_id': cls.company_data['default_account_receivable'].copy().id,
            'property_tax_payable_account_id': cls.company_data['default_account_payable'].copy().id,
        })

        # ==== Sale taxes: group of two taxes having type_tax_use = 'sale' ====

        cls.sale_tax_percentage_incl_1 = cls.env['account.tax'].create({
            'name': 'sale_tax_percentage_incl_1',
            'amount': 20.0,
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'price_include': True,
            'tax_group_id': cls.tax_group_sale.id,
        })

        cls.sale_tax_percentage_excl = cls.env['account.tax'].create({
            'name': 'sale_tax_percentage_excl',
            'amount': 10.0,
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'tax_group_id': cls.tax_group_sale.id,
        })

        cls.sale_tax_group = cls.env['account.tax'].create({
            'name': 'sale_tax_group',
            'amount_type': 'group',
            'type_tax_use': 'sale',
            'children_tax_ids': [(6, 0, (cls.sale_tax_percentage_incl_1 + cls.sale_tax_percentage_excl).ids)],
        })

        cls.move_sale = cls.env['account.move'].create({
            'move_type': 'entry',
            'date': '2016-01-01',
            'journal_id': cls.company_data['default_journal_sale'].id,
            'line_ids': [
                (0, 0, {
                    'debit': 1320.0,
                    'credit': 0.0,
                    'account_id': cls.company_data['default_account_receivable'].id,
                }),
                (0, 0, {
                    'debit': 0.0,
                    'credit': 120.0,
                    'account_id': cls.tax_account.id,
                    'tax_repartition_line_id': cls.sale_tax_percentage_excl.invoice_repartition_line_ids.filtered(lambda x: x.repartition_type == 'tax').id,
                }),
                (0, 0, {
                    'debit': 0.0,
                    'credit': 200.0,
                    'account_id': cls.tax_account.id,
                    'tax_repartition_line_id': cls.sale_tax_percentage_incl_1.invoice_repartition_line_ids.filtered(lambda x: x.repartition_type == 'tax').id,
                    'tax_ids': [(6, 0, cls.sale_tax_percentage_excl.ids)]
                }),
                (0, 0, {
                    'debit': 0.0,
                    'credit': 1000.0,
                    'account_id': cls.company_data['default_account_revenue'].id,
                    'tax_ids': [(6, 0, cls.sale_tax_group.ids)]
                }),
            ],
        })
        cls.move_sale.post()

        # ==== Purchase taxes: group of taxes having type_tax_use = 'none' ====

        cls.none_tax_percentage_incl_2 = cls.env['account.tax'].create({
            'name': 'none_tax_percentage_incl_2',
            'amount': 20.0,
            'amount_type': 'percent',
            'type_tax_use': 'none',
            'price_include': True,
            'tax_group_id': cls.tax_group_purchase.id,
        })

        cls.none_tax_percentage_excl = cls.env['account.tax'].create({
            'name': 'none_tax_percentage_excl',
            'amount': 30.0,
            'amount_type': 'percent',
            'type_tax_use': 'none',
            'tax_group_id': cls.tax_group_purchase.id,
        })

        cls.purchase_tax_group = cls.env['account.tax'].create({
            'name': 'purchase_tax_group',
            'amount_type': 'group',
            'type_tax_use': 'purchase',
            'children_tax_ids': [(6, 0, (cls.none_tax_percentage_incl_2 + cls.none_tax_percentage_excl).ids)],
        })

        cls.move_purchase = cls.env['account.move'].create({
            'move_type': 'entry',
            'date': '2016-01-01',
            'journal_id': cls.company_data['default_journal_purchase'].id,
            'line_ids': [
                (0, 0, {
                    'debit': 0.0,
                    'credit': 3120.0,
                    'account_id': cls.company_data['default_account_payable'].id,
                }),
                (0, 0, {
                    'debit': 720.0,
                    'credit': 0.0,
                    'account_id': cls.tax_account.id,
                    'tax_repartition_line_id': cls.none_tax_percentage_excl.invoice_repartition_line_ids.filtered(lambda x: x.repartition_type == 'tax').id,
                }),
                (0, 0, {
                    'debit': 400.0,
                    'credit': 0.0,
                    'account_id': cls.tax_account.id,
                    'tax_repartition_line_id': cls.none_tax_percentage_incl_2.invoice_repartition_line_ids.filtered(lambda x: x.repartition_type == 'tax').id,
                    'tax_ids': [(6, 0, cls.none_tax_percentage_excl.ids)]
                }),
                (0, 0, {
                    'debit': 2000.0,
                    'credit': 0.0,
                    'account_id': cls.company_data['default_account_expense'].id,
                    'tax_ids': [(6, 0, cls.purchase_tax_group.ids)]
                }),
            ],
        })
        cls.move_purchase.post()

    def test_automatic_vat_closing(self):
        def _get_vat_report_attachments(*args, **kwargs):
            return []

        (self.sale_tax_group + self.purchase_tax_group)\
            .children_tax_ids\
            .invoice_repartition_line_ids\
            .use_in_tax_closing = True

        report = self.env['account.generic.tax.report']
        options = self._init_options(report, fields.Date.from_string('2016-01-01'), fields.Date.from_string('2016-12-31'))

        # Due to warning in runbot when printing wkhtmltopdf in the test, patch the method that fetch the pdf in order
        # to return an empty attachment.
        with patch.object(type(report), '_get_vat_report_attachments', autospec=True, side_effect=_get_vat_report_attachments):
            m = self.move_sale.line_ids.tax_repartition_line_id
            vat_closing_move = report._generate_tax_closing_entry(options)

            self.assertRecordValues(vat_closing_move, [{
                'date': fields.Date.from_string('2016-12-31'),
                'journal_id': self.company_data['company'].account_tax_periodicity_journal_id.id,
            }])
            self.assertRecordValues(vat_closing_move.line_ids, [
                # sale_tax_percentage_incl_1
                {'debit': 200.0,    'credit': 0.0,      'account_id': self.tax_account.id},
                # sale_tax_percentage_excl
                {'debit': 120.0,    'credit': 0.0,      'account_id': self.tax_account.id},
                # none_tax_percentage_incl_2
                {'debit': 0.0,      'credit': 400.0,    'account_id': self.tax_account.id},
                # none_tax_percentage_excl
                {'debit': 0.0,      'credit': 720.0,    'account_id': self.tax_account.id},
                # Balance tax current account (receivable)
                {'debit': 0.0,      'credit': 320.0,    'account_id': self.tax_group_sale.property_tax_payable_account_id.id},
                # Balance tax current account (payable)
                {'debit': 1120.0,   'credit': 0.0,      'account_id': self.tax_group_purchase.property_tax_receivable_account_id.id},
            ])

    def test_generic_tax_report(self):
        report = self.env['account.generic.tax.report']
        options = self._init_options(report, fields.Date.from_string('2016-01-01'), fields.Date.from_string('2016-12-31'))

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                        NET             TAX
            [   0,                                          1,              2],
            [
                ('Sales',                                   '',             ''),

                ('sale_tax_percentage_incl_1 (20.0)',       1000.0,         200.0),
                ('sale_tax_percentage_excl (10.0)',         1200.0,         120.0),

                ('Purchases',                               '',             ''),

                ('purchase_tax_group',                      2000.0,         1120.0),
            ],
        )

    def _create_tax_report_line(self, name, report, tag_name=None, parent_line=None, sequence=None, code=None, formula=None):
        """ Creates a tax report line
        """
        create_vals = {
            'name': name,
            'report_id': report.id,
        }
        if tag_name:
            create_vals['tag_name'] = tag_name
        if parent_line:
            create_vals['parent_id'] = parent_line.id
        if sequence != None:
            create_vals['sequence'] = sequence
        if code:
            create_vals['code'] = code
        if formula:
            create_vals['formula'] = formula

        return self.env['account.tax.report.line'].create(create_vals)

    def test_tax_report_grid(self):
        company = self.company_data['company']
        company.country_id = self.env['res.country'].create({
            'name': "L'Île de la Mouche",
            'code': 'YY',
        })

        # We generate a tax report with the following layout
        #/Base
        #   - Base 42%
        #   - Base 11%
        #/Tax
        #   - Tax 42%
        #       - 10.5%
        #       - 31.5%
        #   - Tax 11%
        #/Tax difference (42% - 11%)

        tax_report = self.env['account.tax.report'].create({
            'name': 'Test',
            'country_id': company.country_id.id,
        })

        # We create the lines in a different order from the one they have in report,
        # so that we ensure sequence is taken into account properly when rendering the report
        tax_section = self._create_tax_report_line('Tax', tax_report, sequence=2)
        base_section = self._create_tax_report_line('Base', tax_report, sequence=1)
        base_11_line = self._create_tax_report_line('Base 11%', tax_report, sequence=2, parent_line=base_section, tag_name='base_11')
        base_42_line = self._create_tax_report_line('Base 42%', tax_report, sequence=1, parent_line=base_section, tag_name='base_42')
        tax_42_section = self._create_tax_report_line('Tax 42%', tax_report, sequence=1, parent_line=tax_section, code='tax_42')
        tax_31_5_line = self._create_tax_report_line('Tax 31.5%', tax_report, sequence=2, parent_line=tax_42_section, tag_name='tax_31_5')
        tax_10_5_line = self._create_tax_report_line('Tax 10.5%', tax_report, sequence=1, parent_line=tax_42_section, tag_name='tax_10_5')
        tax_11_line = self._create_tax_report_line('Tax 10.5%', tax_report, sequence=2, parent_line=tax_section, tag_name='tax_11', code='tax_11')
        tax_difference_line = self._create_tax_report_line('Tax difference (42%-11%)', tax_report, sequence=3, formula='tax_42 - tax_11')

        # Create two taxes linked to report lines
        tax_template_11 = self.env['account.tax.template'].create({
            'name': 'Impôt sur les revenus',
            'amount': '11',
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'chart_template_id': company.chart_template_id.id,
            'invoice_repartition_line_ids': [
                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'plus_report_line_ids': [base_11_line.id],
                }),

                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'plus_report_line_ids': [tax_11_line.id],
                }),
            ],
            'refund_repartition_line_ids': [
                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'minus_report_line_ids': [base_11_line.id],
                }),

                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'minus_report_line_ids': [tax_11_line.id],
                }),
            ],
        })

        tax_template_42 = self.env['account.tax.template'].create({
            'name': 'Impôt sur les revenants',
            'amount': '42',
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'chart_template_id': company.chart_template_id.id,
            'invoice_repartition_line_ids': [
                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'plus_report_line_ids': [base_42_line.id],
                }),

                (0,0, {
                    'factor_percent': 25,
                    'repartition_type': 'tax',
                    'plus_report_line_ids': [tax_10_5_line.id],
                }),

                (0,0, {
                    'factor_percent': 75,
                    'repartition_type': 'tax',
                    'plus_report_line_ids': [tax_31_5_line.id],
                }),
            ],
            'refund_repartition_line_ids': [
                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'minus_report_line_ids': [base_42_line.id],
                }),

                (0,0, {
                    'factor_percent': 25,
                    'repartition_type': 'tax',
                    'minus_report_line_ids': [tax_10_5_line.id],
                }),

                (0,0, {
                    'factor_percent': 75,
                    'repartition_type': 'tax',
                    'minus_report_line_ids': [tax_31_5_line.id],
                }),
            ],
        })
        # The templates needs an xmlid in order so that we can call _generate_tax
        self.env['ir.model.data'].create({
            'name': 'account_reports.test_tax_report_tax_11',
            'module': 'account_reports',
            'res_id': tax_template_11.id,
            'model': 'account.tax.template',
        })
        tax_11_id = tax_template_11._generate_tax(company)['tax_template_to_tax'][tax_template_11.id]
        tax_11 = self.env['account.tax'].browse(tax_11_id)

        self.env['ir.model.data'].create({
            'name': 'account_reports.test_tax_report_tax_42',
            'module': 'account_reports',
            'res_id': tax_template_42.id,
            'model': 'account.tax.template',
        })
        tax_42_id = tax_template_42._generate_tax(company)['tax_template_to_tax'][tax_template_42.id]
        tax_42 = self.env['account.tax'].browse(tax_42_id)

        # Create an invoice using the tax we just made
        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_line_ids': [(0, 0, {
                'name': 'Turlututu',
                'price_unit': 100.0,
                'quantity': 1,
                'account_id': self.company_data['default_account_revenue'].id,
                'tax_ids': [(6, 0, (tax_11 + tax_42).ids)],
            })],
        })
        invoice.post()

        # Generate the report and check the results
        report = self.env['account.generic.tax.report']
        options = self._init_options(report, invoice.date, invoice.date)
        options['tax_report'] = tax_report.id
        report = report.with_context(report._set_context(options))

        # Invalidate the cache to ensure the lines will be fetched in the right order.
        report.invalidate_cache()

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                Balance
            [   0,                                  1],
            [
                (base_section.name,                 200),
                (base_42_line.name,                 100),
                (base_11_line.name,                 100),
                (tax_section.name,                  53),
                (tax_42_section.name,               42),
                (tax_10_5_line.name,                10.5),
                (tax_31_5_line.name,                31.5),
                (tax_11_line.name,                  11),
                (tax_difference_line.name,          31),
            ],
        )

        # We refund the invoice
        refund_wizard = self.env['account.move.reversal'].with_context(active_model="account.move", active_ids=invoice.ids).create({
            'reason': 'Test refund tax repartition',
            'refund_method': 'cancel',
        })
        refund_wizard.reverse_moves()

        # We check the taxes on refund have impacted the report properly (everything should be 0)
        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                Balance
            [   0,                                  1],
            [
                (base_section.name,                 0),
                (base_42_line.name,                 0),
                (base_11_line.name,                 0),
                (tax_section.name,                  0),
                (tax_42_section.name,               0),
                (tax_10_5_line.name,                0),
                (tax_31_5_line.name,                0),
                (tax_11_line.name,                  0),
                (tax_difference_line.name,          0),
            ],
        )
