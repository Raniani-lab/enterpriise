# -*- coding: utf-8 -*-
from unittest.mock import patch

from .common import TestAccountReportsCommon
from odoo.tests import tagged
from odoo import fields
from odoo.tests.common import Form


@tagged('post_install', '-at_install')
class TestTaxReportCarryover(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        company = cls.company_data['company']
        company2 = cls.company_data_2['company']

        fiscal_country = cls.env['res.country'].create({
            'name': "L'Île de la Mouche",
            'code': 'YY',
        })
        company.country_id = company2.country_id = fiscal_country.id
        company.account_tax_periodicity = company2.account_tax_periodicity = 'trimester'
        company2.currency_id = company.currency_id

        company.chart_template_id.country_id = fiscal_country.id

        cls.tax_report = cls.env['account.tax.report'].create({
            'name': 'Test',
            'country_id': company.account_fiscal_country_id.id,
        })

        cls.tax_42_line = cls._create_tax_report_line('Base 42%', cls.tax_report, sequence=1, tag_name='base_42',
                                                      carry_over_condition='no_negative_amount_carry_over_condition')
        cls.tax_11_line = cls._create_tax_report_line('Base 11%', cls.tax_report, sequence=2, tag_name='base_11')

    def test_tax_report_carry_over(self):
        report, _, tax_42 = self._trigger_carryover_line_creation(self.company_data)

        # Due to warning in runbot when printing wkhtmltopdf in the test, patch the method that fetch the pdf in order
        # to return an empty attachment.
        with patch.object(type(report), '_get_vat_report_attachments', autospec=True, side_effect=lambda *args, **kwargs: []):

            # ====== Add a new invoice later than this period, reducing slightly the carried over amount ======

            invoice = self.env['account.move'].create({
                'move_type': 'in_invoice',
                'partner_id': self.partner_a.id,
                'journal_id': self.company_data['default_journal_purchase'].id,
                'date': fields.Date.from_string('2020-06-30'),
                'invoice_line_ids': [(0, 0, {
                    'name': 'Turlututu',
                    'price_unit': 50.0,
                    'quantity': 1,
                    'account_id': self.company_data['default_account_expense'].id,
                    'tax_ids': [(6, 0, tax_42.ids)],
                    })],
            })
            invoice.action_post()
            options = self._init_options(report, invoice.date, invoice.date)

            vat_closing_move = report._generate_tax_closing_entries(options)
            vat_closing_move.action_post()

            # This period is adding another line to the carryover which increase the balance by 21
            carried_over_sum = sum([line.amount for line in self.tax_42_line.carryover_line_ids])
            self.assertEqual(carried_over_sum, -21.0)

            # ====== Add another invoice to stop the carry over ======

            invoice = self.env['account.move'].create({
                'move_type': 'in_invoice',
                'partner_id': self.partner_a.id,
                'journal_id': self.company_data['default_journal_purchase'].id,
                'date': fields.Date.from_string('2020-09-30'),
                'invoice_line_ids': [(0, 0, {
                    'name': 'Turlututu',
                    'price_unit': 500.0,
                    'quantity': 1,
                    'account_id': self.company_data['default_account_expense'].id,
                    'tax_ids': [(6, 0, tax_42.ids)],
                })],
            })
            invoice.action_post()
            options = self._init_options(report, invoice.date, invoice.date)

            vat_closing_move = report._generate_tax_closing_entries(options)
            vat_closing_move.action_post()

            # This period is positive from a larger amount than needed and thus negate the carry over balance
            carried_over_sum = sum([line.amount for line in self.tax_42_line.carryover_line_ids])
            self.assertEqual(carried_over_sum, 0.0)

    def test_tax_report_carry_over_multi_company(self):
        """
        Setup the creation of a carryover line in both companies.
        If the multi-company is working properly, the second one should not get the line from the first one.
        """
        self._trigger_carryover_line_creation(self.company_data_2)
        self._trigger_carryover_line_creation(self.company_data)

    def _trigger_carryover_line_creation(self, company_data):
        tax_11, tax_42 = self._configure_tax_for_company(company_data)

        # Trigger the creation of a carryover line for the selected company
        invoice = self.env['account.move'].create({
            'move_type': 'in_invoice',
            'partner_id': self.partner_a.id,
            'journal_id': company_data['default_journal_purchase'].id,
            'date': fields.Date.from_string('2020-03-31'),
            'invoice_line_ids': [
                (0, 0, {
                    'name': 'Turlututu',
                    'price_unit': 100.0,
                    'quantity': 1,
                    'account_id': company_data['default_account_expense'].id,
                    'tax_ids': [(6, 0, tax_11.ids)]}),

                (0, 0, {
                 'name': 'Turlututu',
                 'price_unit': 100.0,
                 'quantity': 1,
                 'account_id': company_data['default_account_expense'].id,
                 'tax_ids': [(6, 0, tax_42.ids)]})
            ],
        })
        invoice.action_post()

        # Generate the report and check the results
        report = self.env['account.generic.tax.report'].with_company(company_data['company'])
        options = self._init_options(report, invoice.date, invoice.date)
        options['tax_report'] = self.tax_report.id
        report = report.with_context(report._set_context(options))

        # Invalidate the cache to ensure the lines will be fetched in the right order.
        report.invalidate_cache()

        # We refund the invoice
        refund_wizard = self.env['account.move.reversal'].with_context(active_model="account.move",
                                                                       active_ids=invoice.ids).create(
            {
                'reason': 'Test refund tax repartition',
                'refund_method': 'refund',
                'date': fields.Date.from_string('2020-03-31'),
            })
        res = refund_wizard.reverse_moves()
        refund = self.env['account.move'].browse(res['res_id'])

        # Change the value of the line with tax 42 to get a negative value on the report
        move_form = Form(refund)
        with move_form.invoice_line_ids.edit(1) as line_form:
            line_form.price_unit = 200
        move_form.save()

        refund.action_post()

        # Due to warning in runbot when printing wkhtmltopdf in the test, patch the method that fetch the pdf in order
        # to return an empty attachment.
        with patch.object(type(report), '_get_vat_report_attachments', autospec=True, side_effect=lambda *args, **kwargs: []):
            # Generate and post the vat closing move. This should trigger the carry over
            # And create a carry over line for the tax line 42
            vat_closing_move = report._generate_tax_closing_entries(options)
            vat_closing_move.action_post()

            # The negative amount on the line 42 (which is using carry over) was -42.
            # This amount will be carried over to the future in the tax line
            # The with company is required here as without it, we would find all lines from both companies
            carried_over_sum = sum([line.amount for line in self.tax_42_line.with_company(company_data['company']).carryover_line_ids])
            self.assertEqual(carried_over_sum, -42.0)

        # return the information needed to do further tests if needed
        return report, tax_11, tax_42

    def _configure_tax_for_company(self, company_data):
        company = company_data['company']

        tax_group_purchase = self.env['account.tax.group'].with_company(company).sudo().create({
            'name': 'tax_group_purchase',
            'property_tax_receivable_account_id': company_data['default_account_receivable'].copy().id,
            'property_tax_payable_account_id': company_data['default_account_payable'].copy().id,
        })

        tax_template_11 = self.env['account.tax.template'].create({
            'name': 'Impôt sur les revenus',
            'tax_group_id': tax_group_purchase.id,
            'amount': '11',
            'amount_type': 'percent',
            'type_tax_use': 'purchase',
            'chart_template_id': company.chart_template_id.id,
            'invoice_repartition_line_ids': [
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'use_in_tax_closing': True
                }),
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'plus_report_line_ids': [self.tax_11_line.id],
                    'use_in_tax_closing': True
                }),
            ],
            'refund_repartition_line_ids': [
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'use_in_tax_closing': True
                }),
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'minus_report_line_ids': [self.tax_11_line.id],
                    'use_in_tax_closing': True
                }),
            ],
        })

        tax_template_42 = self.env['account.tax.template'].create({
            'name': 'Impôt sur les revenants',
            'tax_group_id': tax_group_purchase.id,
            'amount': '42',
            'amount_type': 'percent',
            'type_tax_use': 'purchase',
            'chart_template_id': company.chart_template_id.id,
            'invoice_repartition_line_ids': [
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'use_in_tax_closing': True
                }),
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'plus_report_line_ids': [self.tax_42_line.id],
                    'use_in_tax_closing': True
                }),
            ],
            'refund_repartition_line_ids': [
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'use_in_tax_closing': True
                }),
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'minus_report_line_ids': [self.tax_42_line.id],
                    'use_in_tax_closing': True
                }),
            ],
        })

        # The templates needs an xmlid in order so that we can call _generate_tax
        self.env['ir.model.data'].create({
            'name': 'account_reports.test_tax_report_tax_11_'+company.name,
            'module': 'account_reports',
            'res_id': tax_template_11.id,
            'model': 'account.tax.template',
        })
        tax_11_id = tax_template_11._generate_tax(company)['tax_template_to_tax'][tax_template_11.id]
        tax_11 = self.env['account.tax'].browse(tax_11_id)

        self.env['ir.model.data'].create({
            'name': 'account_reports.test_tax_report_tax_42_'+company.name,
            'module': 'account_reports',
            'res_id': tax_template_42.id,
            'model': 'account.tax.template',
        })
        tax_42_id = tax_template_42._generate_tax(company)['tax_template_to_tax'][tax_template_42.id]
        tax_42 = self.env['account.tax'].browse(tax_42_id)

        return tax_11, tax_42
