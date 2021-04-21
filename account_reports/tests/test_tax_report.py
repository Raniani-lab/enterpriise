# -*- coding: utf-8 -*-
from unittest.mock import patch

from .common import TestAccountReportsCommon
from odoo import fields, Command
from odoo.tests import tagged
from odoo.exceptions import UserError


@tagged('post_install', '-at_install')
class TestTaxReport(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        # Create country data

        cls.fiscal_country = cls.env['res.country'].create({
            'name': "Discworld",
            'code': 'DW',
        })

        cls.country_state_1 = cls.env['res.country.state'].create({
            'name': "Ankh Morpork",
            'code': "AM",
            'country_id': cls.fiscal_country.id,
        })

        cls.country_state_2 = cls.env['res.country.state'].create({
            'name': "Counterweight Continent",
            'code': "CC",
            'country_id': cls.fiscal_country.id,
        })

        # Setup fiscal data
        cls.company_data['company'].write({
            'country_id': cls.fiscal_country.id, # Will also set fiscal_country_id
            'state_id': cls. country_state_1.id, # Not necessary at the moment; put there for consistency and robustness with possible future changes
            'account_tax_periodicity': 'trimester',
        })
        cls.company_data['company'].chart_template_id.country_id = cls.fiscal_country # So that we can easily instantiate test tax templates within this country


        # Prepare tax groups
        cls.tax_group_1 = cls._instantiate_basic_test_tax_group()
        cls.tax_group_2 = cls._instantiate_basic_test_tax_group()

        # Prepare tax accounts
        cls.tax_account_1 = cls.env['account.account'].create({
            'name': 'Tax Account',
            'code': '250000',
            'user_type_id': cls.env.ref('account.data_account_type_current_liabilities').id,
            'company_id': cls.company_data['company'].id,
        })

        cls.tax_account_2 = cls.env['account.account'].create({
            'name': 'Tax Account',
            'code': '250001',
            'user_type_id': cls.env.ref('account.data_account_type_current_liabilities').id,
            'company_id': cls.company_data['company'].id,
        })

        # ==== Sale taxes: group of two taxes having type_tax_use = 'sale' ====
        cls.sale_tax_percentage_incl_1 = cls.env['account.tax'].create({
            'name': 'sale_tax_percentage_incl_1',
            'amount': 20.0,
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'price_include': True,
            'tax_group_id': cls.tax_group_1.id,
        })

        cls.sale_tax_percentage_excl = cls.env['account.tax'].create({
            'name': 'sale_tax_percentage_excl',
            'amount': 10.0,
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'tax_group_id': cls.tax_group_1.id,
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
                    'account_id': cls.tax_account_1.id,
                    'tax_repartition_line_id': cls.sale_tax_percentage_excl.invoice_repartition_line_ids.filtered(lambda x: x.repartition_type == 'tax').id,
                }),
                (0, 0, {
                    'debit': 0.0,
                    'credit': 200.0,
                    'account_id': cls.tax_account_1.id,
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
        cls.move_sale.action_post()

        # ==== Purchase taxes: group of taxes having type_tax_use = 'none' ====

        cls.none_tax_percentage_incl_2 = cls.env['account.tax'].create({
            'name': 'none_tax_percentage_incl_2',
            'amount': 20.0,
            'amount_type': 'percent',
            'type_tax_use': 'none',
            'price_include': True,
            'tax_group_id': cls.tax_group_2.id,
        })

        cls.none_tax_percentage_excl = cls.env['account.tax'].create({
            'name': 'none_tax_percentage_excl',
            'amount': 30.0,
            'amount_type': 'percent',
            'type_tax_use': 'none',
            'tax_group_id': cls.tax_group_2.id,
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
                    'account_id': cls.tax_account_1.id,
                    'tax_repartition_line_id': cls.none_tax_percentage_excl.invoice_repartition_line_ids.filtered(lambda x: x.repartition_type == 'tax').id,
                }),
                (0, 0, {
                    'debit': 400.0,
                    'credit': 0.0,
                    'account_id': cls.tax_account_1.id,
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
        cls.move_purchase.action_post()

        #Instantiate test data for fiscal_position option of the tax report (both for checking the report and VAT closing)

        # Create a foreign partner
        cls.test_fpos_foreign_partner = cls.env['res.partner'].create({
            'name': "Mare Cel",
            'country_id': cls.fiscal_country.id,
            'state_id': cls.country_state_2.id,
        })

        # Create a tax report and some taxes for it
        cls.basic_tax_report = cls.env['account.tax.report'].create({
            'name': "The Unseen Tax Report",
            'country_id': cls.fiscal_country.id
        })

        cls.test_fpos_tax_sale = cls._add_basic_tax_for_report(
            cls.basic_tax_report, 50, 'sale', cls.tax_group_1,
            [(30, cls.tax_account_1, False), (70, cls.tax_account_1, True), (-10, cls.tax_account_2, True)]
        )

        cls.test_fpos_tax_purchase = cls._add_basic_tax_for_report(
            cls.basic_tax_report, 50, 'purchase', cls.tax_group_2,
            [(10, cls.tax_account_1, False), (60, cls.tax_account_1, True), (-5, cls.tax_account_2, True)]
        )

        # Create a fiscal_position to automatically map the default tax for partner b to our test tax
        cls.foreign_vat_fpos = cls.env['account.fiscal.position'].create({
            'name': "Test fpos",
            'auto_apply': True,
            'country_id': cls.fiscal_country.id,
            'state_ids': cls.country_state_2.ids,
            'foreign_vat': '12345',
        })

        # Create some domestic invoices (not all in the same closing period)
        cls.init_invoice('out_invoice', partner=cls.partner_a, invoice_date='2020-12-22', post=True, amounts=[28000], taxes=cls.test_fpos_tax_sale)
        cls.init_invoice('out_invoice', partner=cls.partner_a, invoice_date='2021-01-22', post=True, amounts=[200], taxes=cls.test_fpos_tax_sale)
        cls.init_invoice('out_refund', partner=cls.partner_a, invoice_date='2021-01-12', post=True, amounts=[20], taxes=cls.test_fpos_tax_sale)
        cls.init_invoice('in_invoice', partner=cls.partner_a, invoice_date='2021-03-12', post=True, amounts=[400], taxes=cls.test_fpos_tax_purchase)
        cls.init_invoice('in_refund', partner=cls.partner_a, invoice_date='2021-03-20', post=True, amounts=[60], taxes=cls.test_fpos_tax_purchase)
        cls.init_invoice('in_invoice', partner=cls.partner_a, invoice_date='2021-04-07', post=True, amounts=[42000], taxes=cls.test_fpos_tax_purchase)

        # Create some foreign invoices (not all in the same closing period)
        cls.init_invoice('out_invoice', partner=cls.test_fpos_foreign_partner, invoice_date='2020-12-13', post=True, amounts=[26000], taxes=cls.test_fpos_tax_sale)
        cls.init_invoice('out_invoice', partner=cls.test_fpos_foreign_partner, invoice_date='2021-01-16', post=True, amounts=[800], taxes=cls.test_fpos_tax_sale)
        cls.init_invoice('out_refund', partner=cls.test_fpos_foreign_partner, invoice_date='2021-01-30', post=True, amounts=[200], taxes=cls.test_fpos_tax_sale)
        cls.init_invoice('in_invoice', partner=cls.test_fpos_foreign_partner, invoice_date='2021-02-01', post=True, amounts=[1000], taxes=cls.test_fpos_tax_purchase)
        cls.init_invoice('in_refund', partner=cls.test_fpos_foreign_partner, invoice_date='2021-03-02', post=True, amounts=[600], taxes=cls.test_fpos_tax_purchase)
        cls.init_invoice('in_refund', partner=cls.test_fpos_foreign_partner, invoice_date='2021-05-02', post=True, amounts=[10000], taxes=cls.test_fpos_tax_purchase)

    @classmethod
    def _instantiate_basic_test_tax_group(cls):
        return cls.env['account.tax.group'].create({
            'name': 'Test tax group',
            'property_tax_receivable_account_id': cls.company_data['default_account_receivable'].copy().id,
            'property_tax_payable_account_id': cls.company_data['default_account_payable'].copy().id,
        })

    @classmethod
    def _add_basic_tax_for_report(cls, tax_report, percentage, type_tax_use, tax_group, tax_repartition):
        """ Creates a basic test tax, as well as tax report lines and tags, connecting them all together.

        A tax report line will be created within tax report for each of the elements in tax_repartition,
        for both invoice and refund, so that the resulting repartition lines each reference their corresponding
        report line. Negative tags will be assign for refund lines; postive tags for invoice ones.

        :param tax_report: The report to create lines for.
        :param percentage: The created tax has amoun_type='percent'. This parameter contains its amount.
        :param type_tax_use: type_tax_use of the tax to create
        :param tax_repartition: List of tuples in the form [(factor_percent, account, use_in_tax_closing)], one tuple
                                for each tax repartition line to create (base lines will be automatically created).
        """
        tax = cls.env['account.tax'].create({
            'name': "%s - %s - %s" % (type_tax_use, percentage, tax_report.name),
            'amount': percentage,
            'amount_type': 'percent',
            'type_tax_use': type_tax_use,
            'tax_group_id': tax_group.id,
            'country_id': tax_report.country_id.id,
        })

        to_write = {}
        for move_type_suffix in ('invoice', 'refund'):
            tax_negate = move_type_suffix == 'refund'
            report_line_sequence = tax_report.line_ids[-1].sequence + 1 if tax_report.line_ids else 0


            # Create a report line for the base
            base_report_line_name = '%s-%s-base' % (tax.id, move_type_suffix)
            base_report_line = cls._create_tax_report_line(base_report_line_name, tax_report, tag_name=base_report_line_name, sequence=report_line_sequence)
            report_line_sequence += 1

            base_tag = base_report_line.tag_ids.filtered(lambda x: x.tax_negate == tax_negate)

            repartition_vals = [
                Command.clear(),
                Command.create({'repartition_type': 'base', 'factor_percent': 100, 'tag_ids': base_tag.ids}),
            ]

            for (factor_percent, account, use_in_tax_closing) in tax_repartition:
                # Create a report line for the reparition line
                tax_report_line_name = "%s-%s-%s" % (tax.id, move_type_suffix, factor_percent)
                tax_report_line = cls._create_tax_report_line(tax_report_line_name, tax_report, tag_name=tax_report_line_name, sequence=report_line_sequence)
                report_line_sequence += 1

                tax_tag = tax_report_line.tag_ids.filtered(lambda x: x.tax_negate == tax_negate)

                repartition_vals.append(Command.create({
                    'account_id': account.id,
                    'factor_percent': factor_percent,
                    'use_in_tax_closing': use_in_tax_closing,
                    'tag_ids': tax_tag.ids,
                }))

            to_write['%s_repartition_line_ids' % move_type_suffix] = repartition_vals

        tax.write(to_write)

        return tax

    def _assert_vat_closing(self, options, closing_vals_by_fpos):
        """ Checks the result of the VAT closing

        :param options: the tax report options to make the closing for
        :param closing_vals_by_fpos: A list of dict(fiscal_position: [dict(line_vals)], where fiscal_position is (possibly empty)
                                     account.fiscal.position record, and line_vals, the expected values for each closing move lines
        """
        report = self.env['account.generic.tax.report']
        with patch.object(type(report), '_get_vat_report_attachments', autospec=True, side_effect=lambda *args, **kwargs: []):
            vat_closing_moves = report._generate_tax_closing_entries(options)

            closing_moves_by_fpos = {move.fiscal_position_id: move for move in vat_closing_moves}
            for fiscal_position, closing_vals in closing_vals_by_fpos.items():
                vat_closing_move = closing_moves_by_fpos[fiscal_position]
                self.assertRecordValues(vat_closing_move.line_ids, closing_vals)
            self.assertEqual(len(closing_vals_by_fpos), len(vat_closing_moves), "Exactly one move should have been generated per fiscal position; nothing else.")

    def test_vat_closing_single_fpos(self):
        """ Tests the VAT closing when a foreign VAT fiscal position is selected on the tax report
        """
        options = self._init_options(
            self.env['account.generic.tax.report'], fields.Date.from_string('2021-01-15'), fields.Date.from_string('2021-02-01'),
            {'tax_report': self.basic_tax_report.id, 'fiscal_position': self.foreign_vat_fpos.id}
        )

        self._assert_vat_closing(options, {
            self.foreign_vat_fpos: [
                # pylint: disable=C0326
                # sales: 800 * 0.5 * 0.7 - 200 * 0.5 * 0.7
                {'debit': 210,      'credit': 0.0,      'account_id': self.tax_account_1.id},
                # sales: 800 * 0.5 * (-0.1) - 200 * 0.5 * (-0.1)
                {'debit': 0,        'credit': 30,       'account_id': self.tax_account_2.id},
                # purchases: 1000 * 0.5 * 0.6 - 600 * 0.5 * 0.6
                {'debit': 0,        'credit': 120,      'account_id': self.tax_account_1.id},
                # purchases: 1000 * 0.5 * (-0.05) - 600 * 0.5 * (-0.05)
                {'debit': 10,       'credit': 0,        'account_id': self.tax_account_2.id},
                # For sales operations
                {'debit': 0,        'credit': 180,      'account_id': self.tax_group_1.property_tax_payable_account_id.id},
                # For purchase operations
                {'debit': 110,      'credit': 0,        'account_id': self.tax_group_2.property_tax_receivable_account_id.id},
            ]
        })

    def test_vat_closing_domestic(self):
        """ Tests the VAT closing when a foreign VAT fiscal position is selected on the tax report
        """
        options = self._init_options(
            self.env['account.generic.tax.report'], fields.Date.from_string('2021-01-15'), fields.Date.from_string('2021-02-01'),
            {'tax_report': self.basic_tax_report.id, 'fiscal_position': 'domestic'}
        )

        self._assert_vat_closing(options, {
            self.env['account.fiscal.position']: [
                # pylint: disable=C0326
                # sales: 200 * 0.5 * 0.7 - 20 * 0.5 * 0.7
                {'debit': 63,       'credit': 0.0,      'account_id': self.tax_account_1.id},
                # sales: 200 * 0.5 * (-0.1) - 20 * 0.5 * (-0.1)
                {'debit': 0,        'credit': 9,        'account_id': self.tax_account_2.id},
                # purchases: 400 * 0.5 * 0.6 - 60 * 0.5 * 0.6
                {'debit': 0,        'credit': 102,      'account_id': self.tax_account_1.id},
                # purchases: 400 * 0.5 * (-0.05) - 60 * 0.5 * (-0.05)
                {'debit': 8.5,      'credit': 0,        'account_id': self.tax_account_2.id},
                # For sales operations
                {'debit': 0,        'credit': 54,       'account_id': self.tax_group_1.property_tax_payable_account_id.id},
                # For purchase operations
                {'debit': 93.5,     'credit': 0,        'account_id': self.tax_group_2.property_tax_receivable_account_id.id},
            ]
        })

    def test_vat_closing_everything(self):
        """ Tests the VAT closing when the option to show all foreign VAT fiscal positions is activated.
        One closing move should then be generated per fiscal position.
        """
        options = self._init_options(
            self.env['account.generic.tax.report'], fields.Date.from_string('2021-01-15'), fields.Date.from_string('2021-02-01'),
            {'tax_report': self.basic_tax_report.id, 'fiscal_position': 'all'}
        )

        self._assert_vat_closing(options, {
            # From test_vat_closing_domestic
            self.env['account.fiscal.position']: [
                # pylint: disable=C0326
                # sales: 200 * 0.5 * 0.7 - 20 * 0.5 * 0.7
                {'debit': 63,       'credit': 0.0,      'account_id': self.tax_account_1.id},
                # sales: 200 * 0.5 * (-0.1) - 20 * 0.5 * (-0.1)
                {'debit': 0,        'credit': 9,        'account_id': self.tax_account_2.id},
                # purchases: 400 * 0.5 * 0.6 - 60 * 0.5 * 0.6
                {'debit': 0,        'credit': 102,      'account_id': self.tax_account_1.id},
                # purchases: 400 * 0.5 * (-0.05) - 60 * 0.5 * (-0.05)
                {'debit': 8.5,      'credit': 0,        'account_id': self.tax_account_2.id},
                # For sales operations
                {'debit': 0,        'credit': 54,       'account_id': self.tax_group_1.property_tax_payable_account_id.id},
                # For purchase operations
                {'debit': 93.5,     'credit': 0,        'account_id': self.tax_group_2.property_tax_receivable_account_id.id},
            ],

            # From test_vat_closing_single_fpos
            self.foreign_vat_fpos: [
                # pylint: disable=C0326
                # sales: 800 * 0.5 * 0.7 - 200 * 0.5 * 0.7
                {'debit': 210,      'credit': 0.0,      'account_id': self.tax_account_1.id},
                # sales: 800 * 0.5 * (-0.1) - 200 * 0.5 * (-0.1)
                {'debit': 0,        'credit': 30,       'account_id': self.tax_account_2.id},
                # purchases: 1000 * 0.5 * 0.6 - 600 * 0.5 * 0.6
                {'debit': 0,        'credit': 120,      'account_id': self.tax_account_1.id},
                # purchases: 1000 * 0.5 * (-0.05) - 600 * 0.5 * (-0.05)
                {'debit': 10,       'credit': 0,        'account_id': self.tax_account_2.id},
                # For sales operations
                {'debit': 0,        'credit': 180,      'account_id': self.tax_group_1.property_tax_payable_account_id.id},
                # For purchase operations
                {'debit': 110,      'credit': 0,        'account_id': self.tax_group_2.property_tax_receivable_account_id.id},
            ],
        })

    def test_tax_report_fpos_domestic(self):
        """ Test tax report's content for 'domestic' foreign VAT fiscal position option.
        """
        report = self.env['account.generic.tax.report']
        options = self._init_options(
            report, fields.Date.from_string('2021-01-01'), fields.Date.from_string('2021-03-31'),
            {'tax_report': self.basic_tax_report.id, 'fiscal_position': 'domestic'}
        )
        self.assertLinesValues(
            report._get_lines(options),
            # pylint: disable=C0326
            #   Name                                                          Balance
            [   0,                                                            1],
            [
                # out_invoice
                ('%s-invoice-base' % self.test_fpos_tax_sale.id,           200),
                ('%s-invoice-30' % self.test_fpos_tax_sale.id,              30),
                ('%s-invoice-70' % self.test_fpos_tax_sale.id,              70),
                ('%s-invoice--10' % self.test_fpos_tax_sale.id,            -10),

                #out_refund
                ('%s-refund-base' % self.test_fpos_tax_sale.id,            -20),
                ('%s-refund-30' % self.test_fpos_tax_sale.id,               -3),
                ('%s-refund-70' % self.test_fpos_tax_sale.id,               -7),
                ('%s-refund--10' % self.test_fpos_tax_sale.id,               1),

                #in_invoice
                ('%s-invoice-base' % self.test_fpos_tax_purchase.id,       400),
                ('%s-invoice-10' % self.test_fpos_tax_purchase.id,          20),
                ('%s-invoice-60' % self.test_fpos_tax_purchase.id,         120),
                ('%s-invoice--5' % self.test_fpos_tax_purchase.id,         -10),

                #in_refund
                ('%s-refund-base' % self.test_fpos_tax_purchase.id,        -60),
                ('%s-refund-10' % self.test_fpos_tax_purchase.id,           -3),
                ('%s-refund-60' % self.test_fpos_tax_purchase.id,          -18),
                ('%s-refund--5' % self.test_fpos_tax_purchase.id,          1.5),
            ],
        )

    def test_tax_report_fpos_foreign(self):
        """ Test tax report's content with a foreign VAT fiscal position.
        """
        report = self.env['account.generic.tax.report']
        options = self._init_options(
            report, fields.Date.from_string('2021-01-01'), fields.Date.from_string('2021-03-31'),
            {'tax_report': self.basic_tax_report.id, 'fiscal_position': self.foreign_vat_fpos.id}
        )
        self.assertLinesValues(
            report._get_lines(options),
            # pylint: disable=C0326
            #   Name                                                          Balance
            [   0,                                                            1],
            [
                # out_invoice
                ('%s-invoice-base' % self.test_fpos_tax_sale.id,           800),
                ('%s-invoice-30' % self.test_fpos_tax_sale.id,             120),
                ('%s-invoice-70' % self.test_fpos_tax_sale.id,             280),
                ('%s-invoice--10' % self.test_fpos_tax_sale.id,            -40),

                #out_refund
                ('%s-refund-base' % self.test_fpos_tax_sale.id,           -200),
                ('%s-refund-30' % self.test_fpos_tax_sale.id,              -30),
                ('%s-refund-70' % self.test_fpos_tax_sale.id,              -70),
                ('%s-refund--10' % self.test_fpos_tax_sale.id,              10),

                #in_invoice
                ('%s-invoice-base' % self.test_fpos_tax_purchase.id,      1000),
                ('%s-invoice-10' % self.test_fpos_tax_purchase.id,          50),
                ('%s-invoice-60' % self.test_fpos_tax_purchase.id,         300),
                ('%s-invoice--5' % self.test_fpos_tax_purchase.id,         -25),

                #in_refund
                ('%s-refund-base' % self.test_fpos_tax_purchase.id,       -600),
                ('%s-refund-10' % self.test_fpos_tax_purchase.id,          -30),
                ('%s-refund-60' % self.test_fpos_tax_purchase.id,         -180),
                ('%s-refund--5' % self.test_fpos_tax_purchase.id,           15),
            ],
        )

    def test_tax_report_fpos_everything(self):
        """ Test tax report's content for 'all' foreign VAT fiscal position option.
        """
        report = self.env['account.generic.tax.report']
        options = self._init_options(
            report, fields.Date.from_string('2021-01-01'), fields.Date.from_string('2021-03-31'),
            {'tax_report': self.basic_tax_report.id, 'fiscal_position': 'all'}
        )
        self.assertLinesValues(
            report._get_lines(options),
            # pylint: disable=C0326
            #   Name                                                          Balance
            [   0,                                                            1],
            [
                # out_invoice
                ('%s-invoice-base' % self.test_fpos_tax_sale.id,          1000),
                ('%s-invoice-30' % self.test_fpos_tax_sale.id,             150),
                ('%s-invoice-70' % self.test_fpos_tax_sale.id,             350),
                ('%s-invoice--10' % self.test_fpos_tax_sale.id,            -50),

                #out_refund
                ('%s-refund-base' % self.test_fpos_tax_sale.id,           -220),
                ('%s-refund-30' % self.test_fpos_tax_sale.id,              -33),
                ('%s-refund-70' % self.test_fpos_tax_sale.id,              -77),
                ('%s-refund--10' % self.test_fpos_tax_sale.id,              11),

                #in_invoice
                ('%s-invoice-base' % self.test_fpos_tax_purchase.id,      1400),
                ('%s-invoice-10' % self.test_fpos_tax_purchase.id,          70),
                ('%s-invoice-60' % self.test_fpos_tax_purchase.id,         420),
                ('%s-invoice--5' % self.test_fpos_tax_purchase.id,         -35),

                #in_refund
                ('%s-refund-base' % self.test_fpos_tax_purchase.id,       -660),
                ('%s-refund-10' % self.test_fpos_tax_purchase.id,          -33),
                ('%s-refund-60' % self.test_fpos_tax_purchase.id,         -198),
                ('%s-refund--5' % self.test_fpos_tax_purchase.id,         16.5),
            ],
        )

    def test_tax_report_single_fpos(self):
        """ When opening the tax report from a foreign country for which there exists only one
        foreing VAT fiscal position, this fiscal position should be selected by default in the
        report's options.
        """
        new_country = self.env['res.country'].create({
            'name': "The Principality of Zeon",
            'code': 'PZ',
        })
        new_tax_report = self.env['account.tax.report'].create({
            'name': "",
            'country_id': new_country.id
        })
        foreign_vat_fpos = self.env['account.fiscal.position'].create({
            'name': "Test fpos",
            'country_id': new_country.id,
            'foreign_vat': '422211',
        })
        options = self._init_options(
            self.env['account.generic.tax.report'], fields.Date.from_string('2021-01-01'), fields.Date.from_string('2021-03-31'),
            {'tax_report': new_tax_report.id}
        )
        self.assertEqual(options['fiscal_position'], foreign_vat_fpos.id, "When only one VAT fiscal position is available for a non-domestic country, it should be chosen by default")

    def test_generic_tax_report(self):
        report = self.env['account.generic.tax.report']
        options = self._init_options(
            report, fields.Date.from_string('2016-01-01'), fields.Date.from_string('2016-12-31'),
            {'tax_report': 'generic'}
        )

        self.assertLinesValues(
            report._get_lines(options),
            # pylint: disable=C0326
            #   Name                                        NET             TAX
            [   0,                                          1,              2],
            [
                ('Sales',                                   2200.0,         320.0),

                ('sale_tax_percentage_incl_1 (20.0)',       1000.0,         200.0),
                ('sale_tax_percentage_excl (10.0)',         1200.0,         120.0),

                ('Purchases',                               2000.0,         1120.0),

                ('purchase_tax_group',                      2000.0,         1120.0),
            ],
        )

    def test_generic_tax_report_comparisons(self):
        invoices = self.env['account.move'].create([{
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': invoice_date,
            'date': invoice_date,
            'invoice_line_ids': [(0, 0, {
                'product_id': self.product_a.id,
                'price_unit': price_unit,
                'tax_ids': [(6, 0, self.sale_tax_percentage_excl.ids)],
            })],
        } for invoice_date, price_unit in (('2019-01-01', 100.0), ('2019-02-01', 1000.0), ('2019-03-01', 10000.0))])
        invoices.action_post()

        report = self.env['account.generic.tax.report']
        options = self._init_options(
            report, fields.Date.from_string('2019-03-01'), fields.Date.from_string('2019-03-31'),
            {'tax_report': 'generic'}
        )
        options = self._update_comparison_filter(options, report, 'previous_period', 2)

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                        NET             TAX             NET             TAX             NET             TAX
            [   0,                                          1,              2,              3,              4,              5,              6],
            [
                ('Sales',                                   10000.0,        1000.0,         1000.0,         100.0,          100.0,          10.0),
                ('sale_tax_percentage_excl (10.0)',         10000.0,        1000.0,         1000.0,         100.0,          100.0,          10.0),
            ],
        )

    def test_generic_tax_report_by_account_tax(self):
        report = self.env['account.generic.tax.report']
        options = self._init_options(
            report, fields.Date.from_string('2016-01-01'), fields.Date.from_string('2016-12-31'),
            {'tax_report': 'generic_grouped_account_tax'}
        )
        with self.assertRaises(UserError):
            report._get_lines(options)

        # Remove the move using a tax with 'amount_type': 'group'
        self.move_purchase.button_draft()
        self.move_purchase.posted_before = False
        self.move_purchase.unlink()
        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                        NET             TAX
            [   0,                                               1,             2],
            [
                ('Sales',                                   2200.0,         320.0),
                ('400000 Product Sales',                    2000.0,         300.0),
                ('sale_tax_percentage_incl_1 (20.0)',       1000.0,         200.0),
                ('sale_tax_percentage_excl (10.0)',         1000.0,         100.0),
                ('250000 Tax Account',                       200.0,          20.0),
                ('sale_tax_percentage_excl (10.0)',          200.0,          20.0),
            ],
        )

    def test_generic_tax_report_by_tax_account(self):
        report = self.env['account.generic.tax.report']
        options = self._init_options(
            report, fields.Date.from_string('2016-01-01'), fields.Date.from_string('2016-12-31'),
            {'tax_report': 'generic_grouped_tax_account'}
        )
        with self.assertRaises(UserError):
            report._get_lines(options)

        # Remove the move using a tax with 'amount_type': 'group'
        self.move_purchase.button_draft()
        self.move_purchase.posted_before = False
        self.move_purchase.unlink()
        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                        NET             TAX
            [   0,                                               1,             2],
            [
                ('Sales',                                   2200.0,         320.0),
                ('sale_tax_percentage_incl_1 (20.0)',       1000.0,         200.0),
                ('400000 Product Sales',                    1000.0,         200.0),
                ('sale_tax_percentage_excl (10.0)',         1200.0,         120.0),
                ('250000 Tax Account',                       200.0,          20.0),
                ('400000 Product Sales',                    1000.0,         100.0),
            ],
        )

    def test_tax_report_grid(self):
        company = self.company_data['company']

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
            'country_id': company.account_fiscal_country_id.id,
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
        tax_neg_10_line = self._create_tax_report_line('Tax -10%', tax_report, sequence=3, parent_line=tax_section, tag_name='tax_neg_10', code='tax_neg_10')
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

                (0,0, {
                    'factor_percent': -10,
                    'repartition_type': 'tax',
                    'minus_report_line_ids': [tax_neg_10_line.id],
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

                (0,0, {
                    'factor_percent': -10,
                    'repartition_type': 'tax',
                    'plus_report_line_ids': [tax_neg_10_line.id],
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
        invoice.action_post()

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
                (tax_section.name,                  57.2),
                (tax_42_section.name,               42),
                (tax_10_5_line.name,                10.5),
                (tax_31_5_line.name,                31.5),
                (tax_11_line.name,                  11),
                (tax_neg_10_line.name,              4.2),
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
                (tax_neg_10_line.name,              0),
                (tax_difference_line.name,          0),
            ],
        )

    def _create_caba_taxes_for_report_lines(self, report_lines_dict, company):
        """ Creates cash basis taxes with a specific test repartition and maps them to
        the provided tax_report lines.

        :param report_lines_dict:  A dictionnary mapping tax_type_use values to
                                   tax report lines records
        :param company:            The company to create the test tags for

        :return:                   The created account.tax objects
        """
        rslt = self.env['account.tax']
        for tax_type, report_line in report_lines_dict.items():
            tax_template = self.env['account.tax.template'].create({
                'name': 'Impôt sur tout ce qui bouge',
                'amount': '20',
                'amount_type': 'percent',
                'type_tax_use': tax_type,
                'chart_template_id': company.chart_template_id.id,
                'tax_exigibility': 'on_payment',
                'invoice_repartition_line_ids': [
                    (0,0, {
                        'factor_percent': 100,
                        'repartition_type': 'base',
                        'plus_report_line_ids': report_line.ids,
                    }),

                    (0,0, {
                        'factor_percent': 25,
                        'repartition_type': 'tax',
                        'plus_report_line_ids': report_line.ids,
                    }),

                    (0,0, {
                        'factor_percent': 75,
                        'repartition_type': 'tax',
                        'plus_report_line_ids': report_line.ids,
                    }),
                ],
                'refund_repartition_line_ids': [
                    (0,0, {
                        'factor_percent': 100,
                        'repartition_type': 'base',
                        'minus_report_line_ids': report_line.ids,
                    }),

                    (0,0, {
                        'factor_percent': 25,
                        'repartition_type': 'tax',
                        'minus_report_line_ids': report_line.ids,
                    }),

                    (0,0, {
                        'factor_percent': 75,
                        'repartition_type': 'tax',
                    }),
                ],
            })

            # The template needs an xmlid in order so that we can call _generate_tax
            self.env['ir.model.data'].create({
                'name': 'account_reports.test_tax_report_tax_' + tax_type,
                'module': 'account_reports',
                'res_id': tax_template.id,
                'model': 'account.tax.template',
            })
            tax_id = tax_template._generate_tax(self.env.user.company_id)['tax_template_to_tax'][tax_template.id]
            rslt += self.env['account.tax'].browse(tax_id)

        return rslt

    def _run_caba_generic_test(self, expected_columns, expected_lines, on_invoice_created=None, on_all_invoices_created=None, invoice_generator=None):
        """ Generic test function called by several cash basis tests.

        This function creates a new sale and purchase tax, each associated with
        a new tax report line using _create_caba_taxes_for_report_lines.
        It then creates an invoice AND a refund for each of these tax, and finally
        compare the tax report to the expected values, passed in parameters.

        Since _create_caba_taxes_for_report_lines creates asymmetric taxes (their 75%
        repartition line does not impact the report line at refund), we can be sure this
        function helper gives a complete coverage, and does not shadow any result due, for
        example, to some undesired swapping between debit and credit.

        :param expected_columns:          The columns we want the final tax report to contain

        :param expected_lines:            The lines we want the final tax report to contain

        :param on_invoice_created:        A function to be called when a single invoice has
                                          just been created, taking the invoice as a parameter
                                          (This can be used to reconcile the invoice with something, for example)

        :param on_all_invoices_created:   A function to be called when all the invoices corresponding
                                          to a tax type have been created, taking the
                                          recordset of all these invoices as a parameter
                                          (Use it to reconcile invoice and credit note together, for example)

        :param invoice_generator:         A function used to generate an invoice. A default
                                          one is called if none is provided, creating
                                          an invoice with a single line amounting to 100,
                                          with the provided tax set on it.
        """
        def default_invoice_generator(inv_type, partner, account, date, tax):
            return self.env['account.move'].create({
                'move_type': inv_type,
                'partner_id': partner.id,
                'date': date,
                'invoice_line_ids': [(0, 0, {
                    'name': 'test',
                    'quantity': 1,
                    'account_id': account.id,
                    'price_unit': 100,
                    'tax_ids': [(6, 0, tax.ids)],
                })],
            })

        today = fields.Date.today()

        company = self.company_data['company']
        partner = self.env['res.partner'].create({'name': 'Char Aznable'})

        # Create a tax report
        tax_report = self.env['account.tax.report'].create({
            'name': 'Test',
            'country_id': self.fiscal_country.id,
        })

        # We create some report lines
        report_lines_dict = {
            'sale': self._create_tax_report_line('Sale', tax_report, sequence=1, tag_name='sale'),
            'purchase': self._create_tax_report_line('Purchase', tax_report, sequence=2, tag_name='purchase'),
        }

        # We create a sale and a purchase tax, linked to our report lines' tags
        taxes = self._create_caba_taxes_for_report_lines(report_lines_dict, company)


        # Create invoice and refund using the tax we just made
        invoice_types = {
            'sale': ('out_invoice', 'out_refund'),
            'purchase': ('in_invoice', 'in_refund')
        }

        account_types = {
            'sale': self.env.ref('account.data_account_type_revenue').id,
            'purchase': self.env.ref('account.data_account_type_expenses').id,
        }
        for tax in taxes:
            invoices = self.env['account.move']
            account = self.env['account.account'].search([('company_id', '=', company.id), ('user_type_id', '=', account_types[tax.type_tax_use])], limit=1)
            for inv_type in invoice_types[tax.type_tax_use]:
                invoice = (invoice_generator or default_invoice_generator)(inv_type, partner, account, today, tax)
                invoice.action_post()
                invoices += invoice

                if on_invoice_created:
                    on_invoice_created(invoice)

            if on_all_invoices_created:
                on_all_invoices_created(invoices)

        # Generate the report and check the results
        report = self.env['account.generic.tax.report']
        report_opt = report._get_options({'date': {'period_type': 'custom', 'filter': 'custom', 'date_to': today, 'mode': 'range', 'date_from': today}})
        new_context = report._set_context(report_opt)

        # We check the taxes on invoice have impacted the report properly
        inv_report_lines = report.with_context(new_context)._get_lines(report_opt)

        self.assertLinesValues(inv_report_lines, expected_columns, expected_lines)


    def test_tax_report_grid_cash_basis(self):
        """ Cash basis moves create for taxes based on payments are handled differently
        by the report; we want to ensure their sign is managed properly.
        """
        def register_payment_for_invoice(invoice):
            """ Fully pay the invoice, so that the cash basis entries are created
            """
            payment_method_xmlid = 'account.account_payment_method_manual_in' if invoice.is_inbound() else 'account.account_payment_method_manual_out'
            self.env['account.payment.register'].with_context(active_ids=invoice.ids, active_model='account.move').create({
                'payment_date': invoice.date,
                'payment_method_id': self.env['ir.model.data'].xmlid_to_res_id(payment_method_xmlid),
            })._create_payments()

        # 100 (base, invoice) - 100 (base, refund) + 20 (tax, invoice) - 5 (25% tax, refund) = 15
        self._run_caba_generic_test(
            #   Name                      Balance
            [   0,                        1],
            [
                ('Sale',                     15),
                ('Purchase',                 15),
            ],
            on_invoice_created=register_payment_for_invoice
        )

    def test_tax_report_grid_cash_basis_refund(self):
        """ Cash basis moves create for taxes based on payments are handled differently
        by the report; we want to ensure their sign is managed properly. This
        test runs the case where an invoice is reconciled with a refund (created
        separetely, so not cancelling it).
        """
        def reconcile_opposite_types(invoices):
            """ Reconciles the created invoices with their matching refund.
            """
            invoices.mapped('line_ids').filtered(lambda x: x.account_internal_type in ('receivable', 'payable')).reconcile()

        # 100 (base, invoice) - 100 (base, refund) + 20 (tax, invoice) - 5 (25% tax, refund) = 15
        self._run_caba_generic_test(
            #   Name                      Balance
            [   0,                        1],
            [
                ('Sale',                     15),
                ('Purchase',                 15),
            ],
            on_all_invoices_created=reconcile_opposite_types
        )

    def test_tax_report_grid_cash_basis_misc_pmt(self):
        """ Cash basis moves create for taxes based on payments are handled differently
        by the report; we want to ensure their sign is managed properly. This
        test runs the case where the invoice is paid with a misc operation instead
        of a payment.
        """
        def reconcile_with_misc_pmt(invoice):
            """ Create a misc operation equivalent to a full payment and reconciles
            the invoice with it.
            """
            # Pay the invoice with a misc operation simulating a payment, so that the cash basis entries are created
            invoice_reconcilable_line = invoice.line_ids.filtered(lambda x: x.account_internal_type in ('payable', 'receivable'))
            account = (invoice.line_ids - invoice_reconcilable_line).account_id
            pmt_move = self.env['account.move'].create({
                'move_type': 'entry',
                'date': invoice.date,
                'line_ids': [(0, 0, {
                                'account_id': invoice_reconcilable_line.account_id.id,
                                'debit': invoice_reconcilable_line.credit,
                                'credit': invoice_reconcilable_line.debit,
                            }),
                            (0, 0, {
                                'account_id': account.id,
                                'credit': invoice_reconcilable_line.credit,
                                'debit': invoice_reconcilable_line.debit,
                            })],
            })
            pmt_move.action_post()
            payment_reconcilable_line = pmt_move.line_ids.filtered(lambda x: x.account_internal_type in ('payable', 'receivable'))
            (invoice_reconcilable_line + payment_reconcilable_line).reconcile()

        # 100 (base, invoice) - 100 (base, refund) + 20 (tax, invoice) - 5 (25% tax, refund) = 15
        self._run_caba_generic_test(
            #   Name                      Balance
            [   0,                        1],
            [
                ('Sale',                     15),
                ('Purchase',                 15),
            ],
            on_invoice_created=reconcile_with_misc_pmt
        )

    def test_tax_report_grid_caba_negative_inv_line(self):
        """ Tests cash basis taxes work properly in case a line of the invoice
        has been made with a negative quantities and taxes (causing debit and
        credit to be inverted on the base line).
        """
        def neg_line_invoice_generator(inv_type, partner, account, date, tax):
            """ Invoices created here have a line at 100 with a negative quantity of -1.
            They also required a second line (here 200), so that the invoice doesn't
            have a negative total, but we don't put any tax on it.
            """
            return self.env['account.move'].create({
                'move_type': inv_type,
                'partner_id': partner.id,
                'date': date,
                'invoice_line_ids': [
                    (0, 0, {
                        'name': 'test',
                        'quantity': -1,
                        'account_id': account.id,
                        'price_unit': 100,
                        'tax_ids': [(6, 0, tax.ids)],
                    }),

                    # Second line, so that the invoice doesn't have a negative total
                    (0, 0, {
                        'name': 'test',
                        'quantity': 1,
                        'account_id': account.id,
                        'price_unit': 200,
                    }),
                ],
            })

        def register_payment_for_invoice(invoice):
            """ Fully pay the invoice, so that the cash basis entries are created
            """
            payment_method_xmlid = 'account.account_payment_method_manual_in' if invoice.is_inbound() else 'account.account_payment_method_manual_out'
            self.env['account.payment.register'].with_context(active_ids=invoice.ids, active_model='account.move').create({
                'payment_date': invoice.date,
                'payment_method_id': self.env['ir.model.data'].xmlid_to_res_id(payment_method_xmlid),
            })._create_payments()

        # -100 (base, invoice) + 100 (base, refund) - 20 (tax, invoice) + 5 (25% tax, refund) = -15
        self._run_caba_generic_test(
            #   Name                      Balance
            [   0,                        1],
            [
                ('Sale',                     -15),
                ('Purchase',                 -15),
            ],
            on_invoice_created=register_payment_for_invoice,
            invoice_generator=neg_line_invoice_generator,
        )

    def test_fiscal_position_switch_all_option_flow(self):
        """ 'all' fiscal position option sometimes must be reset or enforced in order to keep
        the report consistent. We check those cases here.
        """
        foreign_country = self.env['res.country'].create({
            'name': "The Principality of Zeon",
            'code': 'PZ',
        })
        foreign_tax_report = self.env['account.tax.report'].create({
            'name': "",
            'country_id': foreign_country.id
        })
        foreign_vat_fpos = self.env['account.fiscal.position'].create({
            'name': "Test fpos",
            'country_id': foreign_country.id,
            'foreign_vat': '422211',
        })
        report = self.env['account.generic.tax.report']

        # Case 1: 'all' allowed if multiple fpos
        to_check = report._get_options({'fiscal_position': 'all', 'tax_report': self.basic_tax_report.id})
        self.assertEqual(to_check['fiscal_position'], 'all', "Opening the report with 'all' fiscal_position option should work if there are fiscal positions for different states in that country")

        # Case 2: 'all' not allowed if domestic and no fpos
        self.foreign_vat_fpos.foreign_vat = None # No unlink because setupClass created some moves with it
        to_check = report._get_options({'fiscal_position': 'all', 'tax_report': self.basic_tax_report.id})
        self.assertEqual(to_check['fiscal_position'], 'domestic', "Opening the domestic report with 'all' should change to 'domestic' if there's no state-specific fiscal position in the country")

        # Case 3: 'all' not allowed on foreign report with 1 fpos
        to_check = report._get_options({'fiscal_position': 'all', 'tax_report': foreign_tax_report.id})
        self.assertEqual(to_check['fiscal_position'], foreign_vat_fpos.id, "Opening a foreign report with only one single fiscal position with 'all' option should change if to only select this fiscal position")

        # Case 4: always 'all' on generic report
        to_check = report._get_options({'fiscal_position': foreign_vat_fpos.id, 'tax_report': 'generic'})
        self.assertEqual(to_check['fiscal_position'], 'all', "The generic report should always use 'all' fiscal position option.")
