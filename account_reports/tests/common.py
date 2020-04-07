# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import time

from odoo import fields
from odoo.tests import common
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests.common import Form, SavepointCase
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT
from odoo.tools.misc import formatLang
from unittest.mock import patch
import datetime
import copy

import logging
_logger = logging.getLogger(__name__)


def _init_options(report, date_from, date_to):
    ''' Create new options at a certain date.
    :param report:          The report.
    :param filter:          One of the following values: ('today', 'custom', 'this_month', 'this_quarter', 'this_year', 'last_month', 'last_quarter', 'last_year').
    :param date_from:       A datetime object or False.
    :param date_to:         A datetime object.
    :return:                The newly created options.
    '''
    report.filter_date = {
        'date_from': date_from.strftime(DEFAULT_SERVER_DATE_FORMAT),
        'date_to': date_to.strftime(DEFAULT_SERVER_DATE_FORMAT),
        'filter': 'custom',
        'mode': report.filter_date.get('mode', 'range'),
    }
    return report._get_options(None)


class TestAccountReportsCommonMethods(SavepointCase):

    def _init_options(self, report, date_from, date_to):
        return _init_options(report, date_from, date_to)

    def _update_comparison_filter(self, options, report, comparison_type, number_period, date_from=None, date_to=None):
        ''' Modify the existing options to set a new filter_comparison.
        :param options:         The report options.
        :param report:          The report.
        :param comparison_type: One of the following values: ('no_comparison', 'custom', 'previous_period', 'previous_year').
        :param number_period:   The number of period to compare.
        :param date_from:       A datetime object for the 'custom' comparison_type.
        :param date_to:         A datetime object the 'custom' comparison_type.
        :return:                The newly created options.
        '''
        report.filter_comparison = {
            'date_from': date_from and date_from.strftime(DEFAULT_SERVER_DATE_FORMAT),
            'date_to': date_to and date_to.strftime(DEFAULT_SERVER_DATE_FORMAT),
            'filter': comparison_type,
            'number_period': number_period,
        }
        new_options = copy.deepcopy(options)
        report._init_filter_comparison(new_options)
        return new_options

    def _update_multi_selector_filter(self, options, option_key, selected_ids):
        ''' Modify a selector in the options to select .
        :param options:         The report options.
        :param option_key:      The key to the option.
        :param selected_ids:    The ids to be selected.
        :return:                The newly created options.
        '''
        new_options = copy.deepcopy(options)
        for c in new_options[option_key]:
            c['selected'] = c['id'] in selected_ids
        return new_options

    def mocked_today(self, forced_today):
        ''' Helper to make easily a python "with statement" mocking the "today" date.
        :param forced_today:    The expected "today" date as a str or Date object.
        :return:                An object to be used like 'with self.mocked_today(<today>):'.
        '''

        if isinstance(forced_today, str):
            forced_today = fields.Date.from_string(forced_today)

        class WithToday:
            def __init__(self):

                self.patchers = (
                    patch.object(fields.Date, 'today', lambda *args, **kwargs: forced_today),
                    patch.object(fields.Date, 'context_today', lambda *args, **kwargs: forced_today),
                )

            def __enter__(self):
                for patcher in self.patchers:
                    patcher.start()

            def __exit__(self, type, value, traceback):
                for patcher in self.patchers:
                    patcher.stop()

        return WithToday()

    def debug_mode(self, report):
        def user_has_groups(groups):
            if groups == 'base.group_no_one':
                return True
            return self.env.user.user_has_groups(groups)

        class WithDebugMode:
            def __init__(self):
                self.patcher = patch.object(report, 'user_has_groups', lambda *args, **kwargs: user_has_groups(*args, **kwargs))

            def __enter__(self):
                self.patcher.start()

            def __exit__(self, type, value, traceback):
                self.patcher.stop()

        return WithDebugMode()

    def assertHeadersValues(self, headers, expected_headers):
        ''' Helper to compare the headers returned by the _get_table method
        with some expected results.
        An header is a row of columns. Then, headers is a list of list of dictionary.
        :param headers:             The headers to compare.
        :param expected_headers:    The expected headers.
        :return:
        '''
        # Check number of header lines.
        self.assertEqual(len(headers), len(expected_headers))

        for header, expected_header in zip(headers, expected_headers):
            # Check number of columns.
            self.assertEqual(len(header), len(expected_header))

            for i, column in enumerate(header):
                # Check name.
                self.assertEqual(column['name'], expected_header[i][0])
                # Check colspan.
                self.assertEqual(column.get('colspan', 1), expected_header[i][1])

    def assertLinesValues(self, lines, columns, expected_values, currency_map={}):
        ''' Helper to compare the lines returned by the _get_lines method
        with some expected results.
        :param lines:               See _get_lines.
        :param columns:             The columns index.
        :param expected_values:     A list of iterables.
        :param currency_map:        A map mapping each column_index to some extra options to test the lines:
            - currency:             The currency to be applied on the column.
            - currency_code_index:  The index of the column containing the currency code.
        '''

        # Compare the table length to see if any line is missing
        self.assertEqual(len(lines), len(expected_values))

        # Compare cell by cell the current value with the expected one.
        i = 0
        to_compare_list = []
        for line in lines:
            j = 0
            compared_values = [[], []]
            for index in columns:
                expected_value = expected_values[i][j]

                if index == 0:
                    current_value = line['name']
                else:
                    colspan = line.get('colspan', 1)
                    line_index = index - colspan
                    if line_index < 0:
                        current_value = ''
                    else:
                        current_value = line['columns'][line_index].get('name', '')

                currency_data = currency_map.get(index, {})
                used_currency = None
                if 'currency' in currency_data:
                    used_currency = currency_data['currency']
                elif 'currency_code_index' in currency_data:
                    currency_code = line['columns'][currency_data['currency_code_index'] - 1].get('name', '')
                    if currency_code:
                        used_currency = self.env['res.currency'].search([('name', '=', currency_code)], limit=1)
                        assert used_currency, "Currency having name=%s not found." % currency_code
                if not used_currency:
                    used_currency = self.env.company.currency_id

                if type(expected_value) in (int, float) and type(current_value) == str:
                    expected_value = formatLang(self.env, expected_value, currency_obj=used_currency)

                compared_values[0].append(current_value)
                compared_values[1].append(expected_value)

                j += 1
            to_compare_list.append(compared_values)
            i += 1

        errors = []
        for i, to_compare in enumerate(to_compare_list):
            if to_compare[0] != to_compare[1]:
                errors += [
                    "\n==== Differences at index %s ====" % str(i),
                    "Current Values:  %s" % str(to_compare[0]),
                    "Expected Values: %s" % str(to_compare[1]),
                ]
        if errors:
            self.fail('\n'.join(errors))


class TestAccountReportsCommonNew(AccountTestInvoicingCommon, TestAccountReportsCommonMethods):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.company_data_2 = cls.setup_company_data('company_2_data', currency_id=cls.currency_data['currency'].id)


class TestAccountReportsCommon(TestAccountReportsCommonMethods):

    # -------------------------------------------------------------------------
    # DATA GENERATION
    # -------------------------------------------------------------------------

    @classmethod
    def setUpClass(cls):
        super(TestAccountReportsCommon, cls).setUpClass()

        chart_template = cls.env.ref('l10n_generic_coa.configurable_chart_template', raise_if_not_found=False)
        if not chart_template:
            _logger.warning('Reports Tests skipped because l10n_generic_coa is not installed')
            cls.skipTest(cls, reason="l10n_generic_coa not installed")

        # Create companies.
        cls.company_parent = cls.env['res.company'].create({
            'name': 'company_parent',
            'currency_id': cls.env.ref('base.USD').id,
        })
        cls.company_child_eur = cls.env['res.company'].create({
            'name': 'company_child_eur',
            'currency_id': cls.env.ref('base.EUR').id,
        })
        # In real life those companies are flushed at that time.
        # If we don't flush that could lead to issues when recomputing
        # fields on the child_company when loading the chart template
        cls.env['base'].flush()

        # EUR = 2 USD
        cls.eur_to_usd = cls.env['res.currency.rate'].create({
            'name': '2016-01-01',
            'rate': 2.0,
            'currency_id': cls.env.ref('base.EUR').id,
            'company_id': cls.company_parent.id,
        })

        # Create user.
        user = cls.env['res.users'].create({
            'name': 'Because I am reportman!',
            'login': 'reportman',
            'groups_id': [(6, 0, cls.env.user.groups_id.ids), (4, cls.env.ref('account.group_account_user').id)],
            'company_id': cls.company_parent.id,
            'company_ids': [(6, 0, (cls.company_parent + cls.company_child_eur).ids)],
        })
        user.partner_id.email = 'reportman@test.com'

        # Shadow the current environment/cursor with one having the report user.
        cls.env = cls.env(user=user)
        cls.cr = cls.env.cr

        # Get the new chart of accounts using the new environment.
        chart_template = cls.env.ref('l10n_generic_coa.configurable_chart_template')

        cls.partner_category_a = cls.env['res.partner.category'].create({'name': 'partner_categ_a'})
        cls.partner_category_b = cls.env['res.partner.category'].create({'name': 'partner_categ_b'})

        cls.partner_a = cls.env['res.partner'].create(
            {'name': 'partner_a', 'company_id': False, 'category_id': [(6, 0, [])]})
        cls.partner_b = cls.env['res.partner'].create(
            {'name': 'partner_b', 'company_id': False, 'category_id': [(6, 0, [cls.partner_category_a.id])]})
        cls.partner_c = cls.env['res.partner'].create(
            {'name': 'partner_c', 'company_id': False, 'category_id': [(6, 0, [cls.partner_category_b.id])]})
        cls.partner_d = cls.env['res.partner'].create(
            {'name': 'partner_d', 'company_id': False, 'category_id': [(6, 0, [cls.partner_category_a.id, cls.partner_category_b.id])]})

        # Init data for company_parent.
        chart_template.with_company(cls.company_parent).try_loading()

        cls.dec_year_minus_2 = datetime.datetime.strptime('2016-12-01', DEFAULT_SERVER_DATE_FORMAT).date()
        cls.jan_year_minus_1 = datetime.datetime.strptime('2017-01-01', DEFAULT_SERVER_DATE_FORMAT).date()
        cls.feb_year_minus_1 = datetime.datetime.strptime('2017-02-01', DEFAULT_SERVER_DATE_FORMAT).date()
        cls.mar_year_minus_1 = datetime.datetime.strptime('2017-03-01', DEFAULT_SERVER_DATE_FORMAT).date()
        cls.apr_year_minus_1 = datetime.datetime.strptime('2017-04-01', DEFAULT_SERVER_DATE_FORMAT).date()

        # December
        inv_dec_1 = cls._create_invoice(cls.env, 1200.0, cls.partner_a, 'out_invoice', cls.dec_year_minus_2)
        cls._create_payment(cls.env, cls.jan_year_minus_1, inv_dec_1, 600.0)
        inv_dec_2 = cls._create_invoice(cls.env, 1200.0, cls.partner_b, 'in_invoice', cls.dec_year_minus_2)
        pay_inv_dec_2 = cls._create_payment(cls.env, cls.dec_year_minus_2, inv_dec_2, 1200.0)
        cls._create_bank_statement(cls.env, pay_inv_dec_2)
        inv_dec_3 = cls._create_invoice(cls.env, 1200.0, cls.partner_c, 'in_invoice', cls.dec_year_minus_2)
        inv_dec_4 = cls._create_invoice(cls.env, 1200.0, cls.partner_d, 'in_invoice', cls.dec_year_minus_2)

        # January
        inv_jan_1 = cls._create_invoice(cls.env, 100.0, cls.partner_a, 'out_invoice', cls.jan_year_minus_1)
        inv_jan_2 = cls._create_invoice(cls.env, 100.0, cls.partner_b, 'out_invoice', cls.jan_year_minus_1)
        pay_inv_jan_2 = cls._create_payment(cls.env, cls.jan_year_minus_1, inv_jan_2, 100.0)
        cls._create_bank_statement(cls.env, pay_inv_jan_2)
        inv_jan_3 = cls._create_invoice(cls.env, 100.0, cls.partner_c, 'in_invoice', cls.jan_year_minus_1)
        pay_inv_jan_3 = cls._create_payment(cls.env, cls.feb_year_minus_1, inv_jan_3, 50.0)
        cls._create_bank_statement(cls.env, pay_inv_jan_3)
        inv_jan_4 = cls._create_invoice(cls.env, 100.0, cls.partner_d, 'out_invoice', cls.jan_year_minus_1)

        # February
        inv_feb_1 = cls._create_invoice(cls.env, 200.0, cls.partner_a, 'in_invoice', cls.feb_year_minus_1)
        inv_feb_2 = cls._create_invoice(cls.env, 200.0, cls.partner_b, 'out_invoice', cls.feb_year_minus_1)
        inv_feb_3 = cls._create_invoice(cls.env, 200.0, cls.partner_c, 'out_invoice', cls.feb_year_minus_1)
        pay_inv_feb_3 = cls._create_payment(cls.env, cls.mar_year_minus_1, inv_feb_3, 100.0)
        cls._create_bank_statement(cls.env, pay_inv_feb_3, reconcile=False)
        inv_feb_4 = cls._create_invoice(cls.env, 200.0, cls.partner_d, 'in_invoice', cls.feb_year_minus_1)
        cls._create_payment(cls.env, cls.feb_year_minus_1, inv_feb_4, 200.0)

        # March
        inv_mar_1 = cls._create_invoice(cls.env, 300.0, cls.partner_a, 'in_invoice', cls.mar_year_minus_1)
        cls._create_payment(cls.env, cls.mar_year_minus_1, inv_mar_1, 300.0)
        inv_mar_2 = cls._create_invoice(cls.env, 300.0, cls.partner_b, 'in_invoice', cls.mar_year_minus_1)
        inv_mar_3 = cls._create_invoice(cls.env, 300.0, cls.partner_c, 'out_invoice', cls.mar_year_minus_1)
        cls._create_payment(cls.env, cls.apr_year_minus_1, inv_mar_3, 150.0)
        inv_mar_4 = cls._create_invoice(cls.env, 300.0, cls.partner_d, 'out_invoice', cls.mar_year_minus_1)

        # Init data for company_child_eur.
        # Data are the same as the company_parent with doubled amount.
        # However, due to the foreign currency (2 EUR = 1 USD), the amounts are divided by two during the foreign
        # currency conversion.
        user.company_id = cls.company_child_eur
        chart_template.with_company(cls.company_child_eur).try_loading()

        # Currency has been reset to USD during the installation of the chart template.
        cls.company_child_eur.currency_id = cls.env.ref('base.EUR')

        # December
        inv_dec_5 = cls._create_invoice(cls.env, 2400.0, cls.partner_a, 'out_invoice', cls.dec_year_minus_2)
        cls._create_payment(cls.env, cls.jan_year_minus_1, inv_dec_5, 1200.0)
        inv_dec_6 = cls._create_invoice(cls.env, 2400.0, cls.partner_b, 'in_invoice', cls.dec_year_minus_2)
        pay_inv_dec_6 = cls._create_payment(cls.env, cls.dec_year_minus_2, inv_dec_6, 2400.0)
        cls._create_bank_statement(cls.env, pay_inv_dec_6)
        inv_dec_7 = cls._create_invoice(cls.env, 2400.0, cls.partner_c, 'in_invoice', cls.dec_year_minus_2)
        inv_dec_8 = cls._create_invoice(cls.env, 2400.0, cls.partner_d, 'in_invoice', cls.dec_year_minus_2)

        # January
        inv_jan_5 = cls._create_invoice(cls.env, 200.0, cls.partner_a, 'out_invoice', cls.jan_year_minus_1)
        inv_jan_6 = cls._create_invoice(cls.env, 200.0, cls.partner_b, 'out_invoice', cls.jan_year_minus_1)
        pay_inv_jan_6 = cls._create_payment(cls.env, cls.jan_year_minus_1, inv_jan_6, 200.0)
        cls._create_bank_statement(cls.env, pay_inv_jan_6)
        inv_jan_7 = cls._create_invoice(cls.env, 200.0, cls.partner_c, 'in_invoice', cls.jan_year_minus_1)
        pay_inv_jan_7 = cls._create_payment(cls.env, cls.feb_year_minus_1, inv_jan_7, 100.0)
        cls._create_bank_statement(cls.env, pay_inv_jan_7)
        inv_jan_8 = cls._create_invoice(cls.env, 200.0, cls.partner_d, 'out_invoice', cls.jan_year_minus_1)

        # February
        inv_feb_5 = cls._create_invoice(cls.env, 400.0, cls.partner_a, 'in_invoice', cls.feb_year_minus_1)
        inv_feb_6 = cls._create_invoice(cls.env, 400.0, cls.partner_b, 'out_invoice', cls.feb_year_minus_1)
        inv_feb_7 = cls._create_invoice(cls.env, 400.0, cls.partner_c, 'out_invoice', cls.feb_year_minus_1)
        pay_inv_feb_7 = cls._create_payment(cls.env, cls.mar_year_minus_1, inv_feb_7, 200.0)
        cls.t1 = pay_inv_feb_7
        cls.t2 = cls._create_bank_statement(cls.env, pay_inv_feb_7, reconcile=False)
        inv_feb_8 = cls._create_invoice(cls.env, 400.0, cls.partner_d, 'in_invoice', cls.feb_year_minus_1)
        cls._create_payment(cls.env, cls.feb_year_minus_1, inv_feb_8, 400.0)

        # Mars
        inv_mar_5 = cls._create_invoice(cls.env, 600.0, cls.partner_a, 'in_invoice', cls.mar_year_minus_1)
        cls._create_payment(cls.env, cls.mar_year_minus_1, inv_mar_5, 600.0)
        inv_mar_6 = cls._create_invoice(cls.env, 600.0, cls.partner_b, 'in_invoice', cls.mar_year_minus_1)
        inv_mar_7 = cls._create_invoice(cls.env, 600.0, cls.partner_c, 'out_invoice', cls.mar_year_minus_1)
        cls._create_payment(cls.env, cls.apr_year_minus_1, inv_mar_7, 300.0)
        inv_mar_8 = cls._create_invoice(cls.env, 600.0, cls.partner_d, 'out_invoice', cls.mar_year_minus_1)

        user.company_id = cls.company_parent

        # Write the property on tag group
        cls.tax_rec_account = cls.env['account.account'].create({
            'name': 'TAX receivable account',
            'code': 'TAX REC',
            'user_type_id': cls.env.ref('account.data_account_type_current_assets').id,
            'company_id': cls.company_parent.id,
        })
        cls.tax_pay_account = cls.env['account.account'].create({
            'name': 'TAX payable account',
            'code': 'TAX PAY',
            'user_type_id': cls.env.ref('account.data_account_type_current_assets').id,
            'company_id': cls.company_parent.id,
        })
        cls.tax_adv_account = cls.env['account.account'].create({
            'name': 'TAX advance account',
            'code': 'TAX ADV',
            'user_type_id': cls.env.ref('account.data_account_type_current_assets').id,
            'company_id': cls.company_parent.id,
        })
        # Set the tax rec/pay on tax_group
        tax_groups = cls.env['account.tax.group'].search([])
        tax_groups.write({
            'property_tax_receivable_account_id': cls.tax_rec_account,
            'property_tax_payable_account_id': cls.tax_pay_account
        })

        # Date filter helper
        cls.january_date = datetime.datetime.strptime('2018-01-01', DEFAULT_SERVER_DATE_FORMAT).date()
        cls.january_end_date = datetime.datetime.strptime('2018-01-31', DEFAULT_SERVER_DATE_FORMAT).date()
        cls.february_date = datetime.datetime.strptime('2018-02-01', DEFAULT_SERVER_DATE_FORMAT).date()
        cls.february_end_date = datetime.datetime.strptime('2018-02-28', DEFAULT_SERVER_DATE_FORMAT).date()

        # Create ir.filters to test the financial reports.
        cls.ir_filters_partner_a = cls.env['ir.filters'].create({
            'name': 'ir_filters_partner_a',
            'model_id': 'account.move.line',
            'domain': str([('partner_id.name', '=', 'partner_a')]),
        })
        cls.ir_filters_groupby_partner_id_company_id = cls.env['ir.filters'].create({
            'name': 'ir_filters_groupby_partner_id_company_id',
            'model_id': 'account.move.line',
            'context': str({'group_by': ['company_id', 'partner_id']}),
        })

    @staticmethod
    def _create_invoice(env, amount, partner, invoice_type, date, clear_taxes=False):
        ''' Helper to create an account.move on the fly with only one line.
        N.B: The taxes are also applied.
        :param amount:          The amount of the unique account.move.line.
        :param partner:         The partner.
        :param invoice_type:    The invoice type.
        :param date:            The invoice date as a datetime object.
        :return:                An account.move record.
        '''
        invoice_form = Form(env['account.move'].with_context(default_move_type=invoice_type, default_date=date, default_invoice_date=date))
        invoice_form.partner_id = partner
        with invoice_form.invoice_line_ids.new() as invoice_line_form:
            invoice_line_form.name = 'test'
            invoice_line_form.price_unit = amount
            if clear_taxes:
                invoice_line_form.tax_ids.clear()
        invoice = invoice_form.save()
        invoice.post()
        return invoice

    @staticmethod
    def _create_payment(env, date, invoices, amount=None, journal=None):
        ''' Helper to create an account.payment on the fly for some invoices.
        :param date:        The payment date.
        :param invoices:    The invoices on which the payment is done.
        :param amount:      The payment amount.
        :return:            An account.payment record.
        '''
        vals = {'payment_date': date}
        if amount:
            vals['amount'] = amount
        if journal:
            vals['journal_id'] = journal.id

        return env['account.payment.register']\
            .with_context(active_model='account.move', active_ids=invoices.ids)\
            .create(vals)\
            ._create_payments()

    @staticmethod
    def _create_bank_statement(env, payment, amount=None, reconcile=True):
        ''' Helper to create an account.bank.statement on the fly for a payment.
        :param payment:     An account.payment record.
        :param amount:      An optional custom amount.
        :param reconcile:   Reconcile the newly created statement line with the payment.
        :return:            An account.bank.statement record.
        '''
        amount = amount or (payment.payment_type == 'inbound' and payment.amount or -payment.amount)

        statement = env['account.bank.statement'].create({
            'name': payment.name,
            'date': payment.date,
            'journal_id': payment.journal_id.id,
            'line_ids': [
                (0, 0, {
                    'amount': amount,
                    'payment_ref': payment.name,
                    'partner_id': payment.partner_id.id,
                }),
            ],
        })
        statement.balance_end_real = statement.balance_end
        statement.button_post()
        if reconcile:
            move_line = payment.line_ids.filtered(lambda aml: aml.account_id.internal_type not in ('receivable', 'payable'))
            statement.line_ids[0].reconcile([{'id': move_line.id}])
        return statement
