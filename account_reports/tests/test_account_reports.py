# -*- coding: utf-8 -*-
from odoo.tests import tagged
from odoo.tests.common import Form, SavepointCase
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT, date_utils
from odoo.tools.misc import formatLang

import datetime
import copy
import logging

from dateutil.relativedelta import relativedelta

_logger = logging.getLogger(__name__)


@tagged('post_install', '-at_install')
class TestAccountReports(SavepointCase):

    # -------------------------------------------------------------------------
    # DATA GENERATION
    # -------------------------------------------------------------------------
    
    @classmethod
    def setUpClass(cls):
        super(TestAccountReports, cls).setUpClass()

        chart_template = cls.env.ref('l10n_generic_coa.configurable_chart_template', raise_if_not_found=False)
        if not chart_template:
            _logger.warn('Reports Tests skipped because l10n_generic_coa is not installed')
            cls.skipTest("l10n_generic_coa not installed")

        # Create companies.
        cls.company_parent = cls.env['res.company'].create({
            'name': 'company_parent',
            'currency_id': cls.env.ref('base.USD').id,
        })
        cls.company_child_eur = cls.env['res.company'].create({
            'name': 'company_child_eur',
            'currency_id': cls.env.ref('base.EUR').id,
            'parent_id': cls.company_parent.id,
        })

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
            'groups_id': [(6, 0, cls.env.user.groups_id.ids)],
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
        chart_template.try_loading_for_current_company()

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
        chart_template.try_loading_for_current_company()

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
        cls._create_bank_statement(cls.env, pay_inv_feb_7, reconcile=False)
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

        # Create ir.filters to test the financial reports.
        cls.groupby_partner_filter = cls.env['ir.filters'].create({
            'name': 'report tests groupby filter',
            'model_id': 'account.move.line',
            'domain': '[]',
            'context': str({'group_by': ['partner_id']}),
        })

    @staticmethod
    def _create_invoice(env, amount, partner, invoice_type, date):
        ''' Helper to create an account.invoice on the fly with only one line.
        N.B: The taxes are also applied.
        :param amount:          The amount of the unique account.invoice.line.
        :param partner:         The partner.
        :param invoice_type:    The invoice type.
        :param date:            The invoice date as a datetime object.
        :return:                An account.invoice record.
        '''
        self_ctx = env['account.invoice'].with_context(type=invoice_type)
        journal_id = self_ctx._default_journal().id
        self_ctx = self_ctx.with_context(journal_id=journal_id)
        view = 'account.invoice_form' if 'out' in invoice_type else 'account.invoice_supplier_form'

        with Form(self_ctx, view=view) as invoice_form:
            invoice_form.partner_id = partner
            invoice_form.date_invoice = date
            with invoice_form.invoice_line_ids.new() as invoice_line_form:
                invoice_line_form.name = 'test'
                invoice_line_form.price_unit = amount
        invoice = invoice_form.save()
        invoice.action_invoice_open()
        return invoice

    @staticmethod
    def _create_payment(env, date, invoices, amount=None, journal=None):
        ''' Helper to create an account.payment on the fly for some invoices.
        :param date:        The payment date.
        :param invoices:    The invoices on which the payment is done.
        :param amount:      The payment amount.
        :return:            An account.payment record.
        '''
        self_ctx = env['account.register.payments'].with_context(active_model='account.invoice', active_ids=invoices.ids)
        with Form(self_ctx) as payment_form:
            payment_form.payment_date = date
            if amount:
                payment_form.amount = amount
            if journal:
                payment_form.journal_id = journal
        register_payment = payment_form.save()
        payments_action = register_payment.create_payments()
        return env['account.payment'].search(payments_action['domain'])

    @staticmethod
    def _create_bank_statement(env, payment, amount=None, reconcile=True):
        ''' Helper to create an account.bank.statement on the fly for a payment.
        :param payment:     An account.payment record.
        :param amount:      An optional custom amount.
        :param reconcile:   Reconcile the newly created statement line with the payment.
        :return:            An account.bank.statement record.
        '''
        bank_journal = payment.journal_id
        amount = amount or (payment.payment_type == 'inbound' and payment.amount or -payment.amount)
        with Form(env['account.bank.statement']) as statement_form:
            statement_form.journal_id = bank_journal
            statement_form.date = payment.payment_date
            statement_form.name = payment.name
            with statement_form.line_ids.new() as statement_line_form:
                statement_line_form.date = payment.payment_date
                statement_line_form.name = payment.name
                statement_line_form.partner_id = payment.partner_id
                statement_line_form.amount = amount
            statement_form.balance_end_real = statement_form.balance_end
        statement = statement_form.save()
        if reconcile:
            move_line = payment.move_line_ids.filtered(
                lambda aml: aml.account_id in bank_journal.default_debit_account_id + bank_journal.default_credit_account_id)
            statement.line_ids[0].process_reconciliation(payment_aml_rec=move_line)
        return statement

    # -------------------------------------------------------------------------
    # TESTS METHODS
    # -------------------------------------------------------------------------
    
    def _init_options(self, report, filter, date_from=None, date_to=None):
        ''' Create new options at a certain date.        
        :param report:      The report.
        :param filter:      One of the following values: ('today', 'custom', 'this_month', 'this_quarter', 'this_year', 'last_month', 'last_quarter', 'last_year').
        :param date_from:   A datetime object or False.
        :param date_to:     A datetime object.
        :return:            The newly created options.
        '''
        if date_from and date_to:
            filter_date = {
                'date_from': date_from and date_from.strftime(DEFAULT_SERVER_DATE_FORMAT),
                'date_to': date_to and date_to.strftime(DEFAULT_SERVER_DATE_FORMAT),
                'filter': filter,
            }
        else:
            filter_date = {
                'date': (date_from or date_to).strftime(DEFAULT_SERVER_DATE_FORMAT),
                'filter': filter,
            }
        report.filter_date = filter_date
        options = report._get_options(None)
        report._apply_date_filter(options)
        return options

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
        filter_comparison = {
            'date_from': date_from and date_from.strftime(DEFAULT_SERVER_DATE_FORMAT),
            'date_to': date_to and date_to.strftime(DEFAULT_SERVER_DATE_FORMAT),
            'filter': comparison_type,
            'number_period': number_period,
        }
        new_options = copy.deepcopy(options)
        new_options['comparison'] = filter_comparison
        report._apply_date_filter(new_options)
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

    def assertLinesValues(self, lines, columns, expected_values, currency=None):
        ''' Helper to compare the lines returned by the _get_lines method
        with some expected results.
        :param lines:               See _get_lines.
        :params columns:            The columns index.
        :param expected_values:     A list of iterables.
        '''
        used_currency = currency or self.env.user.company_id.currency_id

        # Compare the table length to see if any line is missing
        self.assertEquals(len(lines), len(expected_values))

        # Compare cell by cell the current value with the expected one.
        i = 0
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

                if type(expected_value) in (int, float) and type(current_value) == str:
                    expected_value = formatLang(self.env, expected_value, currency_obj=used_currency)

                compared_values[0].append(current_value)
                compared_values[1].append(expected_value)

                j += 1
            self.assertEqual(compared_values[0], compared_values[1])
            i += 1

    # -------------------------------------------------------------------------
    # TESTS: General Ledger
    # -------------------------------------------------------------------------
    
    def test_general_ledger_folded_unfolded(self):
        ''' Test folded/unfolded lines. '''
        # Init options.
        report = self.env['account.general.ledger']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Debit           Credit          Balance
            [   0,                                      5,              6,              7],
            [
                # Accounts.
                ('101200 Account Receivable',           2875.00,        800.00,         2075.00),
                ('101300 Tax Paid',                     705.00,         0.00,           705.00),
                ('101401 Bank',                         800.00,         1750.00,        -950.00),
                ('111100 Account Payable',              1750.00,        5405.00,        -3655.00),
                ('111200 Tax Received',                 0.00,           375.00,         -375.00),
                ('200000 Product Sales',                0.00,           1300.00,        -1300.00),
                ('220000 Expenses',                     1100.00,        0.00,           1100.00),
                ('999999 Undistributed Profits/Losses', 3600.00,        1200.00,        2400.00),
                # Report Total.
                ('Total',                               10830.00,       10830.00,       0.00),
            ],
        )

        # Mark the '101200 Account Receivable' line to be unfolded.
        line_id = lines[0]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Date            Partner         Currency    Debit           Credit          Balance
            [   0,                                      1,              3,              4,          5,              6,              7],
            [
                # Account.
                ('101200 Account Receivable',           '',             '',             '',         2875.00,        800.00,         2075.00),
                # Initial Balance.
                ('Initial Balance',                     '',             '',             '',         2185.00,        700.00,         1485.00),
                # Account Move Lines.
                ('BNK1/2017/0004',                      '03/01/2017',   'partner_c',    '',         '',             100.00,         1385.00),
                ('INV/2017/0006',                       '03/01/2017',   'partner_c',    '',         345.00,         '',             1730.00),
                ('INV/2017/0007',                       '03/01/2017',   'partner_d',    '',         345.00,         '',             2075.00),
                # Account Total.
                ('Total ',                              '',             '',             '',         2875.00,        800.00,         2075.00),
            ],
        )

        # Mark the '200000 Product Sales' line to be unfolded.
        # Note: this account has user_type_id.include_initial_balance = False.
        line_id = lines[5]['id']
        options['unfolded_lines'] = [line_id]

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Date            Partner         Currency    Debit           Credit          Balance
            [   0,                                      1,              3,              4,          5,              6,              7],
            [
                # Account.
                ('200000 Product Sales',                '',             '',             '',         0.00,           1300.00,        -1300.00),
                # Initial Balance.
                ('Initial Balance',                     '',             '',             '',         0.00,           700.00,         -700.00),
                # Account Move Lines.
                ('INV/2017/0006',                       '03/01/2017',   'partner_c',    '',         '',             300.00,         -1000.00),
                ('INV/2017/0007',                       '03/01/2017',   'partner_d',    '',         '',             300.00,         -1300.00),
                # Account Total.
                ('Total ',                              '',             '',             '',         0.00,           1300.00,        -1300.00),
            ],
        )

    def test_general_ledger_cash_basis(self):
        ''' Test folded/unfolded lines with the cash basis option. '''
        # Check the cash basis option.
        report = self.env['account.general.ledger']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options['cash_basis'] = True
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Debit           Credit          Balance
            [   0,                                      5,              6,              7],
            [
                # Accounts.
                ('101200 Account Receivable',           800.00,         800.00,         0.00),
                ('101300 Tax Paid',                     228.26,         0.00,           228.26),
                ('101401 Bank',                         800.00,         1750.00,        -950.00),
                ('111100 Account Payable',              1750.00,        1750.00,        0.00),
                ('111200 Tax Received',                 0.00,           104.35,         -104.35),
                ('200000 Product Sales',                0.00,           695.65,         -695.65),
                ('220000 Expenses',                     478.26,         0.00,           478.26),
                # Report Total.
                ('Total',                               4056.52,        5100.00,        -1043.48),
            ],
        )

        # Mark the '101200 Account Receivable' line to be unfolded.
        line_id = lines[0]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Date            Partner         Currency    Debit           Credit          Balance
            [   0,                                      1,              3,              4,          5,              6,              7],
            [
                # Account.
                ('101200 Account Receivable',           '',             '',             '',         800.00,         800.00,         0.00),
                # Initial Balance.
                ('Initial Balance',                     '',             '',             '',         700.00,         700.00,         0.00),
                # Account Move Lines.
                ('INV/2017/0005',                       '02/01/2017',   'partner_c',    '',         100.00,             '',       100.00),
                ('BNK1/2017/0004',                      '03/01/2017',   'partner_c',    '',             '',         100.00,         0.00),
                # Account Total.
                ('Total ',                              '',             '',             '',         800.00,         800.00,         0.00),
            ],
        )

    def test_general_ledger_multi_company(self):
        ''' Test folded/unfolded lines in a multi-company environment. '''
        # Select both company_parent/company_child_eur companies.
        report = self.env['account.general.ledger']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options = self._update_multi_selector_filter(options, 'multi_company', (self.company_parent + self.company_child_eur).ids)
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Debit           Credit          Balance
            [   0,                                      5,              6,              7],
            [
                # Accounts.
                ('101200 Account Receivable',           2875.00,        800.00,         2075.00),
                ('101200 Account Receivable',           2875.00,        800.00,         2075.00),
                ('101300 Tax Paid',                     705.00,         0.00,           705.00),
                ('101300 Tax Paid',                     705.00,         0.00,           705.00),
                ('101401 Bank',                         800.00,         1750.00,        -950.00),
                ('101401 Bank',                         800.00,         1750.00,        -950.00),
                ('111100 Account Payable',              1750.00,        5405.00,        -3655.00),
                ('111100 Account Payable',              1750.00,        5405.00,        -3655.00),
                ('111200 Tax Received',                 0.00,           375.00,         -375.00),
                ('111200 Tax Received',                 0.00,           375.00,         -375.00),
                ('200000 Product Sales',                0.00,           1300.00,        -1300.00),
                ('200000 Product Sales',                0.00,           1300.00,        -1300.00),
                ('220000 Expenses',                     1100.00,        0.00,           1100.00),
                ('220000 Expenses',                     1100.00,        0.00,           1100.00),
                ('999999 Undistributed Profits/Losses', 3600.00,        1200.00,        2400.00),
                ('999999 Undistributed Profits/Losses', 3600.00,        1200.00,        2400.00),
                # Report Total.
                ('Total',                               21660.00,       21660.00,       0.00),
            ],
        )

        # Mark the '101200 Account Receivable' line (for the company_child_eur company) to be unfolded.
        line_id = lines[1]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Date            Partner         Currency    Debit           Credit          Balance
            [   0,                                      1,              3,              4,          5,              6,              7],
            [
                # Account.
                ('101200 Account Receivable',           '',             '',             '',         2875.00,        800.00,         2075.00),
                # Initial Balance.
                ('Initial Balance',                     '',             '',             '',         2185.00,        700.00,         1485.00),
                # Account Move Lines.
                ('BNK1/2017/0004',                      '03/01/2017',   'partner_c',    '',         '',             100.00,         1385.00),
                ('INV/2017/0006',                       '03/01/2017',   'partner_c',    '',         345.00,         '',             1730.00),
                ('INV/2017/0007',                       '03/01/2017',   'partner_d',    '',         345.00,         '',             2075.00),
                # Account Total.
                ('Total ',                              '',             '',             '',         2875.00,        800.00,         2075.00),
            ],
        )

    def test_general_ledger_load_more(self):
        ''' Test the load more feature. '''
        receivable_account = self.env['account.account'].search(
            [('company_id', '=', self.company_parent.id), ('internal_type', '=', 'receivable')])
        line_id = 'account_%s' % receivable_account.id

        # Mark the '101200 Account Receivable' line to be unfolded.
        report = self.env['account.general.ledger']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        # Force the load more to expand lines one by one.
        report.MAX_LINES = 1

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Date            Partner         Currency    Debit           Credit          Balance
            [   0,                                      1,              3,              4,          5,              6,              7],
            [
                # Account.
                ('101200 Account Receivable',           '',             '',             '',         2875.00,        800.00,         2075.00),
                # Initial Balance.
                ('Initial Balance',                     '',             '',             '',         2185.00,        700.00,         1485.00),
                # Account Move Lines.
                ('BNK1/2017/0004',                      '03/01/2017',   'partner_c',    '',         '',             100.00,         1385.00),
                # Load more.
                ('Load more... (2 remaining)',          '',             '',             '',         '',             '',             ''),
                # Account Total.
                ('Total ',                              '',             '',             '',         2875.00,        800.00,         2075.00),
            ],
        )

        # Store the load more values inside the options.
        options['lines_offset'] = 1
        options['lines_progress'] = 1385.00
        report = report.with_context(report._set_context(options))
        report.MAX_LINES = 1

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Date            Partner         Currency    Debit           Credit          Balance
            [   0,                                      1,              3,              4,          5,              6,              7],
            [
                # Account Move Lines.
                ('INV/2017/0006',                       '03/01/2017',   'partner_c',    '',         345.00,         '',             1730.00),
                # Load more.
                ('Load more... (1 remaining)',          '',             '',             '',         '',             '',             ''),
            ],
        )

        # Update the load more values inside the options.
        options['lines_offset'] = 2
        options['lines_progress'] = 1730.00
        report = report.with_context(report._set_context(options))
        report.MAX_LINES = 1

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Date            Partner         Currency    Debit           Credit          Balance
            [   0,                                      1,              3,              4,          5,              6,              7],
            [
                # Account Move Lines.
                ('INV/2017/0007',                       '03/01/2017',   'partner_d',    '',         345.00,         '',             2075.00),
            ],
        )

    def test_general_ledger_tax_declaration(self):
        ''' Test the tax declaration. '''
        journal = self.env['account.journal'].search(
            [('company_id', '=', self.company_parent.id), ('type', '=', 'sale')])

        # Select only the 'Customer Invoices' journal.
        report = self.env['account.general.ledger']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options = self._update_multi_selector_filter(options, 'journals', journal.ids)
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                    Debit           Credit          Balance
            [   0,                                      5,              6,              7],
            [
                # Accounts.
                ('101200 Account Receivable',           2875.00,        0.00,           2875.00),
                ('111200 Tax Received',                 0.00,           375.00,         -375.00),
                ('200000 Product Sales',                0.00,           1300.00,        -1300.00),
                ('999999 Undistributed Profits/Losses', 0.00,           1200.00,        -1200.00),
                # Report Total.
                ('Total',                               2875.00,        2875.00,        0.00),
                # Tax Declaration.
                ('Tax Declaration',                     '',             '',             ''),
                ('Name',                                'Base Amount',  'Tax Amount',   ''),
                ('Tax 15.00% (15.0)',                   600.00,         375.00,         ''),
            ],
        )

    # -------------------------------------------------------------------------
    # TESTS: Partner Ledger
    # -------------------------------------------------------------------------

    def test_partner_ledger_folded_unfolded(self):
        ''' Test folded/unfolded lines. '''
        # Init options.
        report = self.env['account.partner.ledger']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Init. Balance   Debit           Credit          Balance
            [   0,                                      6,              7,              8,              9],
            [
                # Partners.
                ('partner_a',                           665.00,         300.00,         345.00,         620.00),
                ('partner_b',                           65.00,          0.00,           345.00,         -280.00),
                ('partner_c',                           -1215.00,       345.00,         100.00,         -970.00),
                ('partner_d',                           -1295.00,       345.00,         0.00,           -950.00),
                # Report Total.
                ('Total',                               -1780.00,       990.00,         790.00,         -1580.00),
            ],
        )

        # Mark the 'partner_a' line to be unfolded.
        line_id = lines[0]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                    JRNL        Account         Due Date,       Init. Balance   Debit           Credit          Balance
            [   0,                      1,          2,              4,              6,              7,              8,              9],
            [
                # Partner.
                ('partner_a',           '',         '',             '',             665.00,         300.00,         345.00,         620.00),
                # Account Move Lines.
                ('03/01/2017',          'BILL',     '111100',       '03/01/2017',   665.00,         '',             345.00,         320.00),
                ('03/01/2017',          'BNK1',     '111100',       '03/01/2017',   320.00,         300.00,         '',             620.00),
            ],
        )

    def test_partner_ledger_cash_basis(self):
        ''' Test folded/unfolded lines with the cash basis option. '''
        # Check the cash basis option.
        report = self.env['account.partner.ledger']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options['cash_basis'] = True
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Init. Balance   Debit           Credit          Balance
            [   0,                                      6,              7,              8,              9],
            [
                # Partners.
                ('partner_a',                           0.00,           300.00,         300.00,         0.00),
                ('partner_b',                           0.00,           0.00,           0.00,           0.00),
                ('partner_c',                           100.00,         150.00,         100.00,         150.00),
                ('partner_d',                           0.00,           0.00,           0.00,           0.00),
                # Report Total.
                ('Total',                               100.00,         450.00,         400.00,         150.00),
            ],
        )

        # Mark the 'partner_a' line to be unfolded.
        line_id = lines[0]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                    JRNL        Account         Due Date,       Init. Balance   Debit           Credit          Balance
            [   0,                      1,          2,              4,              6,              7,              8,              9],
            [
                # Partner.
                ('partner_a',           '',         '',             '',             0.00,           300.00,         300.00,         0.00),
                # Account Move Lines.
                ('03/01/2017',          'BILL',     '111100',       '03/01/2017',   0.00,           '',             300.00,         -300.00),
                ('03/01/2017',          'BNK1',     '111100',       '03/01/2017',   -300.00,        300.00,         '',             0.00),
            ],
        )

    def test_partner_ledger_multi_company(self):
        ''' Test folded/unfolded lines in a multi-company environment. '''
        # Select both company_parent/company_child_eur companies.
        report = self.env['account.partner.ledger']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options = self._update_multi_selector_filter(options, 'multi_company', (self.company_parent + self.company_child_eur).ids)
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Init. Balance   Debit           Credit          Balance
            [   0,                                      6,              7,              8,              9],
            [
                # Partners.
                ('partner_a',                           1330.00,        600.00,         690.00,         1240.00),
                ('partner_b',                           130.00,         0.00,           690.00,         -560.00),
                ('partner_c',                           -2430.00,       690.00,         200.00,         -1940.00),
                ('partner_d',                           -2590.00,       690.00,         0.00,           -1900.00),
                # Report Total.
                ('Total',                               -3560.00,       1980.00,        1580.00,        -3160.00),
            ],
        )

        # Mark the 'partner_a' line (for the company_child_eur company) to be unfolded.
        line_id = lines[0]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                    JRNL        Account         Due Date,       Init. Balance   Debit           Credit          Balance
            [   0,                      1,          2,              4,              6,              7,              8,              9],
            [
                # Partner.
                ('partner_a',           '',         '',             '',             1330.00,        600.00,         690.00,         1240.00),
                # Account Move Lines.
                ('03/01/2017',          'BILL',     '111100',       '03/01/2017',   1330.00,        '',             345.00,         985.00),
                ('03/01/2017',          'BNK1',     '111100',       '03/01/2017',   985.00,         300.00,         '',             1285.00),
                ('03/01/2017',          'BILL',     '111100',       '03/01/2017',   1285.00,        '',             345.00,         940.00),
                ('03/01/2017',          'BNK1',     '111100',       '03/01/2017',   940.00,         300.00,         '',             1240.00),
            ],
        )

    def test_partner_ledger_load_more(self):
        ''' Test the load more feature. '''
        line_id = 'partner_%s' % self.partner_a.id

        # Mark the 'partner_a' line to be unfolded.
        report = self.env['account.partner.ledger']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options = self._update_multi_selector_filter(options, 'multi_company', (self.company_parent + self.company_child_eur).ids)
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        # Force the load more to expand lines one by one.
        report.MAX_LINES = 1

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                    JRNL        Account         Due Date,       Init. Balance   Debit           Credit          Balance
            [   0,                      1,          2,              4,              6,              7,              8,              9],
            [
                # Partner.
                ('partner_a',           '',         '',             '',             1330.00,        600.00,         690.00,         1240.00),
                # Account Move Lines.
                ('03/01/2017',          'BILL',     '111100',       '03/01/2017',   1330.00,        '',             345.00,         985.00),
                ('Load more... (3 remaining)', '',  '',             '',             '',             '',             '',             ''),
            ],
        )

        # Store the load more values inside the options.
        options['lines_offset'] = 1
        options['lines_progress'] = 985.00
        report = report.with_context(report._set_context(options))
        report.MAX_LINES = 2

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                    JRNL        Account         Due Date,       Init. Balance   Debit           Credit          Balance
            [   0,                      1,          2,              4,              6,              7,              8,              9],
            [
                # Account Move Lines.
                ('03/01/2017',          'BNK1',     '111100',       '03/01/2017',   985.00,         300.00,         '',             1285.00),
                ('03/01/2017',          'BILL',     '111100',       '03/01/2017',   1285.00,        '',             345.00,         940.00),
                # Load more.
                ('Load more... (1 remaining)', '',  '',             '',             '',             '',             '',             ''),
            ],
        )

        # Update the load more values inside the options.
        options['lines_offset'] = 3
        options['lines_progress'] = 940.00
        report = report.with_context(report._set_context(options))
        report.MAX_LINES = 1

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                    JRNL        Account         Due Date,       Init. Balance   Debit           Credit          Balance
            [   0,                      1,          2,              4,              6,              7,              8,              9],
            [
                # Account Move Lines.
                ('03/01/2017',          'BNK1',     '111100',       '03/01/2017',   940.00,         300.00,         '',             1240.00),
            ],
        )

    def test_partner_ledger_account_types(self):
        ''' Test the 'account_type' filter. '''
        # Select only the account having the 'receivable' type.
        report = self.env['account.partner.ledger']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options = self._update_multi_selector_filter(options, 'account_type', ['receivable'])
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Init. Balance   Debit           Credit          Balance
            [   0,                                      6,              7,              8,              9],
            [
                # Partners.
                ('partner_a',                           895.00,         0.00,           0.00,           895.00),
                ('partner_b',                           245.00,         0.00,           0.00,           245.00),
                ('partner_c',                           230.00,         345.00,         100.00,         475.00),
                ('partner_d',                           115.00,         345.00,         0.00,           460.00),
                # Report Total.
                ('Total',                               1485.00,        690.00,         100.00,         2075.00),
            ],
        )

        # Mark the 'partner_c' line to be unfolded.
        line_id = lines[2]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                    JRNL        Account         Due Date,       Init. Balance   Debit           Credit          Balance
            [   0,                      1,          2,              4,              6,              7,              8,              9],
            [
                # Partner.
                ('partner_c',           '',         '',             '',             230.00,         345.00,         100.00,         475.00),
                # Account Move Lines.
                ('03/01/2017',          'BNK1',     '101200',       '03/01/2017',   230.00,         '',             100.00,         130.00),
                ('03/01/2017',          'INV',      '101200',       '03/01/2017',   130.00,         345.00,         '',             475.00),
            ],
        )

        # Select only the account having the 'payable' type.
        report = self.env['account.partner.ledger']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options = self._update_multi_selector_filter(options, 'account_type', ['payable'])
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Init. Balance   Debit           Credit          Balance
            [   0,                                      6,              7,              8,              9],
            [
                # Partners.
                ('partner_a',                           -230.00,        300.00,         345.00,         -275.00),
                ('partner_b',                           -180.00,        0.00,           345.00,         -525.00),
                ('partner_c',                           -1445.00,       0.00,           0.00,           -1445.00),
                ('partner_d',                           -1410.00,       0.00,           0.00,           -1410.00),
                # Report Total.
                ('Total',                               -3265.00,       300.00,         690.00,         -3655.00),
            ],
        )

        # Mark the 'partner_c' line to be unfolded.
        line_id = lines[2]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Init. Balance   Debit           Credit          Balance
            [   0,                                      6,              7,              8,              9],
            [
                # Partners.
                ('partner_c',                           -1445.00,       0.00,           0.00,           -1445.00),
            ],
        )

    # -------------------------------------------------------------------------
    # TESTS: Aged Receivable
    # -------------------------------------------------------------------------

    def test_aged_receivable_folded_unfolded(self):
        ''' Test folded/unfolded lines. '''
        # Init options.
        report = self.env['account.aged.receivable']
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Not Due On,     1 - 30          31 - 60         61 - 90         91 - 120        Older       Total
            [   0,                                      4,              5,              6,              7,              8,              9,          10],
            [
                # Partners.
                ('partner_a',                           0.00,           0.00,           0.00,           115.00,         780.00,         0.00,       895.00),
                ('partner_b',                           0.00,           0.00,           230.00,         15.00,          0.00,           0.00,       245.00),
                ('partner_c',                           0.00,           345.00,         130.00,         0.00,           0.00,           0.00,       475.00),
                ('partner_d',                           0.00,           345.00,         0.00,           115.00,         0.00,           0.00,       460.00),
                # Report Total.
                ('Total',                               0.00,           690.00,         360.00,         245.00,         780.00,         0.00,       2075.00),
            ],
        )

        # Mark the 'partner_d' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                    JRNL        Account         Not Due On,     1 - 30          31 - 60         61 - 90         91 - 120        Older       Total
            [   0,                      1,          2,              4,              5,              6,              7,              8,              9,          10],
            [
                # Partner.
                ('partner_d',           '',         '',             0.00,           345.00,         0.00,           115.00,         0.00,           0.00,       460.00),
                # Account Move Lines.
                ('01/01/2017',          'INV',      '101200',       '',             '',             '',             115.00,         '',             '',         ''),
                ('03/01/2017',          'INV',      '101200',       '',             345.00,         '',             '',             '',             '',         ''),
            ],
        )

    def test_aged_receivable_multi_company(self):
        ''' Test folded/unfolded lines in a multi-company environment. '''
        # Select both company_parent/company_child_eur companies.
        report = self.env['account.aged.receivable']
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        options = self._update_multi_selector_filter(options, 'multi_company', (self.company_parent + self.company_child_eur).ids)
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Not Due On,     1 - 30          31 - 60         61 - 90         91 - 120        Older       Total
            [   0,                                      4,              5,              6,              7,              8,              9,          10],
            [
                # Partners.
                ('partner_a',                           0.00,           0.00,           0.00,           230.00,         1560.00,        0.00,       1790.00),
                ('partner_b',                           0.00,           0.00,           460.00,         30.00,          0.00,           0.00,       490.00),
                ('partner_c',                           0.00,           690.00,         260.00,         0.00,           0.00,           0.00,       950.00),
                ('partner_d',                           0.00,           690.00,         0.00,           230.00,         0.00,           0.00,       920.00),
                # Report Total.
                ('Total',                               0.00,           1380.00,        720.00,         490.00,         1560.00,        0.00,       4150.00),
            ],
        )

        # Mark the 'partner_d' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                    JRNL        Account         Not Due On,     1 - 30          31 - 60         61 - 90         91 - 120        Older       Total
            [   0,                      1,          2,              4,              5,              6,              7,              8,              9,          10],
            [
                # Partner.
                ('partner_d',           '',         '',             0.00,           690.00,         0.00,           230.00,         0.00,           0.00,       920.00),
                # Account Move Lines.
                ('01/01/2017',          'INV',      '101200',       '',             '',             '',             115.00,         '',             '',         ''),
                ('01/01/2017',          'INV',      '101200',       '',             '',             '',             115.00,         '',             '',         ''),
                ('03/01/2017',          'INV',      '101200',       '',             345.00,         '',             '',             '',             '',         ''),
                ('03/01/2017',          'INV',      '101200',       '',             345.00,         '',             '',             '',             '',         ''),
            ],
        )

    def test_aged_receivable_filter_partner(self):
        ''' Test the filter on partners/partner's categories. '''
        # Init options with modified filter_partner:
        # - partner_ids: ('partner_b', 'partner_c', 'partner_d')
        # - partner_categories: ('partner_categ_a')
        report = self.env['account.aged.receivable']
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        options['partner_ids'] = (self.partner_b + self.partner_c + self.partner_d).ids
        options['partner_categories'] = self.partner_category_a.ids
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                    Not Due On,     1 - 30          31 - 60         61 - 90         91 - 120        Older       Total
            [   0,                                      4,              5,              6,              7,              8,              9,          10],
            [
                # Partners.
                ('partner_b',                           0.00,           0.00,           230.00,         15.00,          0.00,           0.00,       245.00),
                ('partner_d',                           0.00,           345.00,         0.00,           115.00,         0.00,           0.00,       460.00),
                # Report Total.
                ('Total',                               0.00,           345.00,         230.00,         130.00,         0.00,           0.00,       705.00),
            ],
        )

    # -------------------------------------------------------------------------
    # TESTS: Aged Payable
    # -------------------------------------------------------------------------

    def test_aged_payable_folded_unfolded(self):
        ''' Test folded/unfolded lines. '''
        # Init options.
        report = self.env['account.aged.payable']
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Not Due On,     1 - 30          31 - 60         61 - 90         91 - 120        Older       Total
            [   0,                                      4,              5,              6,              7,              8,              9,          10],
            [
                # Partners.
                ('partner_a',                           0.00,           45.00,          230.00,         0.00,           0.00,           0.00,       275.00),
                ('partner_b',                           0.00,           345.00,         0.00,           0.00,           180.00,         0.00,       525.00),
                ('partner_c',                           0.00,           0.00,           0.00,           65.00,          1380.00,        0.00,       1445.00),
                ('partner_d',                           0.00,           0.00,           30.00,          0.00,           1380.00,        0.00,       1410.00),
                # Report Total.
                ('Total',                               0.00,           390.00,         260.00,         65.00,          2940.00,        0.00,       3655.00),
            ],
        )

        # Mark the 'partner_d' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                    JRNL        Account         Not Due On,     1 - 30          31 - 60         61 - 90         91 - 120        Older       Total
            [   0,                      1,          2,              4,              5,              6,              7,              8,              9,          10],
            [
                # Partner.
                ('partner_d',           '',         '',             0.00,           0.00,           30.00,          0.00,           1380.00,        0.00,       1410.00),
                # Account Move Lines.
                ('12/01/2016',          'BILL',     '111100',       '',             '',             '',             '',             1380.00,        '',         ''),
                ('02/01/2017',          'BILL',     '111100',       '',             '',             30.00,          '',             '',             '',         ''),
            ],
        )

    def test_aged_payable_multi_company(self):
        ''' Test folded/unfolded lines in a multi-company environment. '''
        # Select both company_parent/company_child_eur companies.
        report = self.env['account.aged.payable']
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        options = self._update_multi_selector_filter(options, 'multi_company', (self.company_parent + self.company_child_eur).ids)
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Not Due On,     1 - 30          31 - 60         61 - 90         91 - 120        Older       Total
            [   0,                                      4,              5,              6,              7,              8,              9,          10],
            [
                # Partners.
                ('partner_a',                           0.00,           90.00,          460.00,         0.00,           0.00,           0.00,       550.00),
                ('partner_b',                           0.00,           690.00,         0.00,           0.00,           360.00,         0.00,       1050.00),
                ('partner_c',                           0.00,           0.00,           0.00,           130.00,         2760.00,        0.00,       2890.00),
                ('partner_d',                           0.00,           0.00,           60.00,          0.00,           2760.00,        0.00,       2820.00),
                # Report Total.
                ('Total',                               0.00,           780.00,         520.00,         130.00,         5880.00,        0.00,       7310.00),
            ],
        )

        # Mark the 'partner_d' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                    JRNL        Account         Not Due On,     1 - 30          31 - 60         61 - 90         91 - 120        Older       Total
            [   0,                      1,          2,              4,              5,              6,              7,              8,              9,          10],
            [
                # Partner.
                ('partner_d',           '',         '',             0.00,           0.00,           60.00,          0.00,           2760.00,        0.00,       2820.00),
                # Account Move Lines.
                ('12/01/2016',          'BILL',     '111100',       '',             '',             '',             '',             1380.00,        '',         ''),
                ('12/01/2016',          'BILL',     '111100',       '',             '',             '',             '',             1380.00,        '',         ''),
                ('02/01/2017',          'BILL',     '111100',       '',             '',             30.00,          '',             '',             '',         ''),
                ('02/01/2017',          'BILL',     '111100',       '',             '',             30.00,          '',             '',             '',         ''),
            ],
        )

    def test_aged_payable_filter_partner(self):
        ''' Test the filter on partners/partner's categories. '''
        # Init options with modified filter_partner:
        # - partner_ids: ('partner_b', 'partner_c', 'partner_d')
        # - partner_categories: ('partner_categ_a')
        report = self.env['account.aged.payable']
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        options['partner_ids'] = (self.partner_b + self.partner_c + self.partner_d).ids
        options['partner_categories'] = self.partner_category_a.ids
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                    Not Due On,     1 - 30          31 - 60         61 - 90         91 - 120        Older       Total
            [   0,                                      4,              5,              6,              7,              8,              9,          10],
            [
                # Partners.
                ('partner_b',                           0.00,           345.00,         0.00,           0.00,           180.00,         0.00,       525.00),
                ('partner_d',                           0.00,           0.00,           30.00,          0.00,           1380.00,        0.00,       1410.00),
                # Report Total.
                ('Total',                               0.00,           345.00,         30.00,          0.00,           1560.00,        0.00,       1935.00),
            ],
        )

    # -------------------------------------------------------------------------
    # TESTS: Trial Balance
    # -------------------------------------------------------------------------

    def test_trial_balance_initial_state(self):
        ''' Test lines with base state. '''
        # Init options.
        report = self.env['account.coa.report']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #                                           [  Initial Balance   ]          [   Month Balance    ]          [       Total        ]
            #   Name                                    Debit           Credit          Debit           Credit          Debit           Credit
            [   0,                                      1,              2,              3,              4,              5,              6],
            [
                # Accounts.
                ('101200 Account Receivable',           1485.00,        '',             690.00,         100.00,         2075.00,        ''),
                ('101300 Tax Paid',                     615.00,         '',             90.00,          '',             705.00,         ''),
                ('101401 Bank',                         '',             750.00,         100.00,         300.00,         '',             950.00),
                ('111100 Account Payable',              '',             3265.00,        300.00,         690.00,         '',             3655.00),
                ('111200 Tax Received',                 '',             285.00,         '',             90.00,          '',             375.00),
                ('200000 Product Sales',                '',             700.00,         '',             600.00,         '',             1300.00),
                ('220000 Expenses',                     500.00,         '',             600,            '',             1100.00,        ''),
                ('999999 Undistributed Profits/Losses', 2400.00,        '',             '',             '',             2400.00,        ''),
                # Report Total.
                ('Total',                               5000.00,        5000.00,        1780.00,        1780.00,        6280.00,        6280.00),
            ],
        )

    def test_trial_balance_cash_basis(self):
        ''' Test the cash basis option. '''
        # Check the cash basis option.
        report = self.env['account.coa.report']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options['cash_basis'] = True
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #                                           [  Initial Balance   ]          [   Month Balance    ]          [       Total        ]
            #   Name                                    Debit           Credit          Debit           Credit          Debit           Credit
            [   0,                                      1,              2,              3,              4,              5,              6],
            [
                # Accounts.
                ('101200 Account Receivable',           '',             '',             100.00,         100.00,         '',             ''),
                ('101300 Tax Paid',                     189.13,         '',             39.13,          '',             228.26,         ''),
                ('101401 Bank',                         '',             750.00,         100.00,         300.00,         '',             950.00),
                ('111100 Account Payable',              '',             '',             300.00,         300.00,         '',             ''),
                ('111200 Tax Received',                 '',             91.30,          '',             13.05,          '',             104.35),
                ('200000 Product Sales',                '',             608.70,         '',             86.95,          '',             695.65),
                ('220000 Expenses',                     217.39,         '',             260.87,         '',             478.26,         ''),
                # Report Total.
                ('Total',                               406.52,         1450.00,        800.00,         800.00,         706.52,         1750.00),
            ],
        )

    def test_trial_balance_multi_company(self):
        ''' Test in a multi-company environment. '''
        # Select both company_parent/company_child_eur companies.
        report = self.env['account.coa.report']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options = self._update_multi_selector_filter(options, 'multi_company', (self.company_parent + self.company_child_eur).ids)
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #                                           [  Initial Balance   ]          [   Month Balance    ]          [       Total        ]
            #   Name                                    Debit           Credit          Debit           Credit          Debit           Credit
            [   0,                                      1,              2,              3,              4,              5,              6],
            [
                # Accounts.
                ('101200 Account Receivable',           1485.00,        '',             690.00,         100.00,         2075.00,        ''),
                ('101200 Account Receivable',           1485.00,        '',             690.00,         100.00,         2075.00,        ''),
                ('101300 Tax Paid',                     615.00,         '',             90.00,          '',             705.00,         ''),
                ('101300 Tax Paid',                     615.00,         '',             90.00,          '',             705.00,         ''),
                ('101401 Bank',                         '',             750.00,         100.00,         300.00,         '',             950.00),
                ('101401 Bank',                         '',             750.00,         100.00,         300.00,         '',             950.00),
                ('111100 Account Payable',              '',             3265.00,        300.00,         690.00,         '',             3655.00),
                ('111100 Account Payable',              '',             3265.00,        300.00,         690.00,         '',             3655.00),
                ('111200 Tax Received',                 '',             285.00,         '',             90.00,          '',             375.00),
                ('111200 Tax Received',                 '',             285.00,         '',             90.00,          '',             375.00),
                ('200000 Product Sales',                '',             700.00,         '',             600.00,         '',             1300.00),
                ('200000 Product Sales',                '',             700.00,         '',             600.00,         '',             1300.00),
                ('220000 Expenses',                     500.00,         '',             600.00,         '',             1100.00,        ''),
                ('220000 Expenses',                     500.00,         '',             600.00,         '',             1100.00,        ''),
                ('999999 Undistributed Profits/Losses', 2400.00,        '',             '',             '',             2400.00,        ''),
                ('999999 Undistributed Profits/Losses', 2400.00,        '',             '',             '',             2400.00,        ''),
                # Report Total.
                ('Total',                               10000.00,       10000.00,       3560.00,        3560.00,        12560.00,       12560.00),
            ],
        )

    def test_trial_balance_journals_filter(self):
        ''' Test the filter on journals. '''
        journal = self.env['account.journal'].search([('company_id', '=', self.company_parent.id), ('type', '=', 'sale')])

        # Init options with only the sale journal selected.
        report = self.env['account.coa.report']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options = self._update_multi_selector_filter(options, 'journals', journal.ids)
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #                                           [  Initial Balance   ]          [   Month Balance    ]          [       Total        ]
            #   Name                                    Debit           Credit          Debit           Credit          Debit           Credit
            [   0,                                      1,              2,              3,              4,              5,              6],
            [
                # Accounts.
                ('101200 Account Receivable',           2185.00,        '',             690.00,         '',             2875.00,        ''),
                ('111200 Tax Received',                 '',             285.00,         '',             90.00,          '',             375.00),
                ('200000 Product Sales',                '',             700.00,         '',             600.00,         '',             1300.00),
                ('999999 Undistributed Profits/Losses', '',             1200.00,        '',             '',             '',             1200.00),
                # Report Total.
                ('Total',                               2185.00,        2185.00,        690.00,         690.00,         2875.00,        2875.00),
            ],
        )

    # -------------------------------------------------------------------------
    # TESTS: Tax Report
    # -------------------------------------------------------------------------

    def test_tax_report_initial_state(self):
        ''' Test taxes lines. '''
        # Init options.
        report = self.env['account.generic.tax.report']
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                    NET             TAX
            [   0,                                      1,              2],
            [
                ('Sales',                               '',             ''),
                ('Tax 15.00% (15.0)',                   600.00,         90.00),
                ('Purchases',                           '',             ''),
                ('Tax 15.00% (15.0)',                   600.00,         90.00),
            ],
        )

    # -------------------------------------------------------------------------
    # TESTS: Balance Sheet + All generic financial report features
    # -------------------------------------------------------------------------

    def test_balance_sheet_initial_state(self):
        ''' Test folded/unfolded lines plus totals_below_sections. '''
        # Init options.
        report = self.env.ref('account_reports.account_financial_report_balancesheet0')._with_correct_filters()
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('ASSETS',                                      ''),
                ('Current Assets',                              ''),
                ('Bank and Cash Accounts',                      -950.00),
                ('Receivables',                                 2075.00),
                ('Current Assets',                              705.00),
                ('Prepayments',                                 0.00),
                ('Total Current Assets',                        1830.00),
                ('Plus Fixed Assets',                           0.00),
                ('Plus Non-current Assets',                     0.00),
                ('Total ASSETS',                                1830.00),

                ('LIABILITIES',                                 ''),
                ('Current Liabilities',                         ''),
                ('Current Liabilities',                         375.00),
                ('Payables',                                    3655.00),
                ('Total Current Liabilities',                   4030.00),
                ('Plus Non-current Liabilities',                0.00),
                ('Total LIABILITIES',                           4030.00),

                ('EQUITY',                                      ''),
                ('Unallocated Earnings',                        ''),
                ('Current Year Unallocated Earnings',           ''),
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
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('Receivables',                                 2075.00),
                ('101200 Account Receivable',                   2075.00),
                ('Total Receivables',                           2075.00),
            ],
        )

        # Uncheck the totals_below_sections boolean on the company.
        self.company_parent.totals_below_sections = False

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('Receivables',                                 2075.00),
                ('101200 Account Receivable',                   2075.00),
            ],
        )

    def test_balance_sheet_cash_basis(self):
        ''' Test folded/unfolded lines with the cash basis option. '''
        # Check the cash basis option.
        report = self.env.ref('account_reports.account_financial_report_balancesheet0')._with_correct_filters()
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        options['cash_basis'] = True
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('ASSETS',                                      ''),
                ('Current Assets',                              ''),
                ('Bank and Cash Accounts',                      -950.00),
                ('Receivables',                                 0.00),
                ('Current Assets',                              0.00),
                ('Prepayments',                                 0.00),
                ('Total Current Assets',                        -950.00),
                ('Plus Fixed Assets',                           0.00),
                ('Plus Non-current Assets',                     0.00),
                ('Total ASSETS',                                -950.00),

                ('LIABILITIES',                                 ''),
                ('Current Liabilities',                         ''),
                ('Current Liabilities',                         0.00),
                ('Payables',                                    0.00),
                ('Total Current Liabilities',                   0.00),
                ('Plus Non-current Liabilities',                0.00),
                ('Total LIABILITIES',                           0.00),

                ('EQUITY',                                      ''),
                ('Unallocated Earnings',                        ''),
                ('Current Year Unallocated Earnings',           ''),
                ('Current Year Earnings',                       0.00),
                ('Current Year Allocated Earnings',             0.00),
                ('Total Current Year Unallocated Earnings',     0.00),
                ('Previous Years Unallocated Earnings',         0.00),
                ('Total Unallocated Earnings',                  0.00),
                ('Retained Earnings',                           0.00),
                ('Total EQUITY',                                0.00),

                ('LIABILITIES + EQUITY',                        0.00),
            ],
        )

    def test_balance_sheet_multi_company(self):
        ''' Test folded/unfolded lines in a multi-company environment. '''
        # Select both company_parent/company_child_eur companies.
        report = self.env.ref('account_reports.account_financial_report_balancesheet0')._with_correct_filters()
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        options = self._update_multi_selector_filter(options, 'multi_company', (self.company_parent + self.company_child_eur).ids)
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('ASSETS',                                      ''),
                ('Current Assets',                              ''),
                ('Bank and Cash Accounts',                      -1900.00),
                ('Receivables',                                 4150.00),
                ('Current Assets',                              1410.00),
                ('Prepayments',                                 0.00),
                ('Total Current Assets',                        3660.00),
                ('Plus Fixed Assets',                           0.00),
                ('Plus Non-current Assets',                     0.00),
                ('Total ASSETS',                                3660.00),

                ('LIABILITIES',                                 ''),
                ('Current Liabilities',                         ''),
                ('Current Liabilities',                         750.00),
                ('Payables',                                    7310.00),
                ('Total Current Liabilities',                   8060.00),
                ('Plus Non-current Liabilities',                0.00),
                ('Total LIABILITIES',                           8060.00),

                ('EQUITY',                                      ''),
                ('Unallocated Earnings',                        ''),
                ('Current Year Unallocated Earnings',           ''),
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
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('Receivables',                                 4150.00),
                ('101200 Account Receivable',                   2075.00),
                ('101200 Account Receivable',                   2075.00),
                ('Total Receivables',                           4150.00),
            ],
        )

    def test_balance_sheet_ir_filters(self):
        ''' Test folded/unfolded lines with custom groupby/domain. '''
        # Init options with the ir.filters.
        report = self.env.ref('account_reports.account_financial_report_balancesheet0')
        report.applicable_filters_ids = [(6, 0, self.groupby_partner_filter.ids)]
        report = report._with_correct_filters()
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])

        # Test the group by filter.
        options = self._update_multi_selector_filter(options, 'ir_filters', self.groupby_partner_filter.ids)
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                            partner_a   partner_b   partner_c   partner_d
            [   0,                                              1,          2,          3,          4],
            [
                ('ASSETS',                                      '',         '',         '',         ''),
                ('Current Assets',                              '',         '',         '',         ''),
                ('Bank and Cash Accounts',                      300.00,     -1100.00,   50.00,      -200.00),
                ('Receivables',                                 895.00,     245.00,     475.00,     460.00),
                ('Current Assets',                              75.00,      225.00,     195.00,     210.00),
                ('Prepayments',                                 0.00,       0.00,       0.00,       0.00),
                ('Total Current Assets',                        1270.00,    -630.00,    720.00,     470.00),
                ('Plus Fixed Assets',                           0.00,       0.00,       0.00,       0.00),
                ('Plus Non-current Assets',                     0.00,       0.00,       0.00,       0.00),
                ('Total ASSETS',                                1270.00,    -630.00,    720.00,     470.00),

                ('LIABILITIES',                                 '',         '',         '',         ''),
                ('Current Liabilities',                         '',         '',         '',         ''),
                ('Current Liabilities',                         195.00,     45.00,      75.00,      60.00),
                ('Payables',                                    275.00,     525.00,     1445.00,    1410.00),
                ('Total Current Liabilities',                   470.00,     570.00,     1520.00,    1470.00),
                ('Plus Non-current Liabilities',                0.00,       0.00,       0.00,       0.00),
                ('Total LIABILITIES',                           470.00,     570.00,     1520.00,    1470.00),

                ('EQUITY',                                      '',         '',         '',         ''),
                ('Unallocated Earnings',                        '',         '',         '',         ''),
                ('Current Year Unallocated Earnings',           '',         '',         '',         ''),
                ('Current Year Earnings',                       -400.00,    0.00,       400.00,     200.00),
                ('Current Year Allocated Earnings',             0.00,       0.00,       0.00,       0.00),
                ('Total Current Year Unallocated Earnings',     -400.00,    0.00,       400.00,     200.00),
                ('Previous Years Unallocated Earnings',         1200.00,    -1200.00,   -1200.00,   -1200.00),
                ('Total Unallocated Earnings',                  800.00,     -1200.00,   -800.00,    -1000.00),
                ('Retained Earnings',                           0.00,       0.00,       0.00,       0.00),
                ('Total EQUITY',                                800.00,     -1200.00,   -800.00,    -1000.00),

                ('LIABILITIES + EQUITY',                        1270.00,    -630.00,    720.00,     470.00),
            ],
        )

        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            partner_a   partner_b   partner_c   partner_d
            [   0,                                              1,          2,          3,          4],
            [
                ('Receivables',                                 895.00,     245.00,     475.00,     460.00),
                ('101200 Account Receivable',                   895.00,     245.00,     475.00,     460.00),
                ('Total Receivables',                           895.00,     245.00,     475.00,     460.00),
            ],
        )

        # Select group by ir.filters.
        options['unfolded_lines'] = []
        options = self._update_multi_selector_filter(options, 'ir_filters', self.groupby_partner_filter.ids)
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                            partner_a   partner_b
            [   0,                                              1,          2],
            [
                ('ASSETS',                                      '',         ''),
                ('Current Assets',                              '',         ''),
                ('Bank and Cash Accounts',                      300.00,     -1100.00),
                ('Receivables',                                 895.00,     245.00),
                ('Current Assets',                              75.00,      225.00),
                ('Prepayments',                                 0.00,       0.00),
                ('Total Current Assets',                        1270.00,    -630.00),
                ('Plus Fixed Assets',                           0.00,       0.00),
                ('Plus Non-current Assets',                     0.00,       0.00),
                ('Total ASSETS',                                1270.00,    -630.00),

                ('LIABILITIES',                                 '',         ''),
                ('Current Liabilities',                         '',         ''),
                ('Current Liabilities',                         195.00,     45.00),
                ('Payables',                                    275.00,     525.00),
                ('Total Current Liabilities',                   470.00,     570.00),
                ('Plus Non-current Liabilities',                0.00,       0.00),
                ('Total LIABILITIES',                           470.00,     570.00),

                ('EQUITY',                                      '',         ''),
                ('Unallocated Earnings',                        '',         ''),
                ('Current Year Unallocated Earnings',           '',         ''),
                ('Current Year Earnings',                       -400.00,    0.00),
                ('Current Year Allocated Earnings',             0.00,       0.00),
                ('Total Current Year Unallocated Earnings',     -400.00,    0.00),
                ('Previous Years Unallocated Earnings',         1200.00,    -1200.00),
                ('Total Unallocated Earnings',                  800.00,     -1200.00),
                ('Retained Earnings',                           0.00,       0.00),
                ('Total EQUITY',                                800.00,     -1200.00),

                ('LIABILITIES + EQUITY',                        1270.00,    -630.00),
            ],
        )

        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            partner_a   partner_b
            [   0,                                              1,          2],
            [
                ('Receivables',                                 895.00,     245.00),
                ('101200 Account Receivable',                   895.00,     245.00),
                ('Total Receivables',                           895.00,     245.00),
            ],
        )

    def test_balance_sheet_debit_credit(self):
        ''' Test folded/unfolded lines with debit_credit checked with/without ir.filters. '''
        # Init options with debit_credit.
        report = self.env.ref('account_reports.account_financial_report_balancesheet0')
        report.debit_credit = True
        report.applicable_filters_ids = [(6, 0, self.groupby_partner_filter.ids)]
        report = report._with_correct_filters()
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                            Debit       Credit      Balance
            [   0,                                              1,          2,          3],
            [
                ('ASSETS',                                      '',         '',         ''),
                ('Current Assets',                              '',         '',         ''),
                ('Bank and Cash Accounts',                      0.00,       0.00,       -950.00),
                ('Receivables',                                 0.00,       0.00,       2075.00),
                ('Current Assets',                              0.00,       0.00,       705.00),
                ('Prepayments',                                 0.00,       0.00,       0.00),
                ('Total Current Assets',                        0.00,       0.00,       1830.00),
                ('Plus Fixed Assets',                           0.00,       0.00,       0.00),
                ('Plus Non-current Assets',                     0.00,       0.00,       0.00),
                ('Total ASSETS',                                0.00,       0.00,       1830.00),

                ('LIABILITIES',                                 '',         '',         ''),
                ('Current Liabilities',                         '',         '',         ''),
                ('Current Liabilities',                         0.00,       0.00,       375.00),
                ('Payables',                                    0.00,       0.00,       3655.00),
                ('Total Current Liabilities',                   0.00,       0.00,       4030.00),
                ('Plus Non-current Liabilities',                0.00,       0.00,       0.00),
                ('Total LIABILITIES',                           0.00,       0.00,       4030.00),

                ('EQUITY',                                      '',         '',         ''),
                ('Unallocated Earnings',                        '',         '',         ''),
                ('Current Year Unallocated Earnings',           '',         '',         ''),
                ('Current Year Earnings',                       0.00,       0.00,       200.00),
                ('Current Year Allocated Earnings',             0.00,       0.00,       0.00),
                ('Total Current Year Unallocated Earnings',     0.00,       0.00,       200.00),
                ('Previous Years Unallocated Earnings',         0.00,       0.00,       -2400.00),
                ('Total Unallocated Earnings',                  0.00,       0.00,       -2200.00),
                ('Retained Earnings',                           0.00,       0.00,       0.00),
                ('Total EQUITY',                                0.00,       0.00,       -2200.00),

                ('LIABILITIES + EQUITY',                        0.00,       0.00,       1830.00),
            ],
        )

        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            Debit       Credit      Balance
            [   0,                                              1,          2,          3],
            [
                ('Receivables',                                 0.00,       0.00,       2075.00),
                ('101200 Account Receivable',                   2875.00,    800.00,     2075.00),
                ('Total Receivables',                           0.00,       0.00,       2075.00),
            ],
        )

        # TODO: Make sure this commented test works after the refactoring of the financial reports.
        # Combining debit_credit with a group by is buggy in stable version but very hard to debug.

        # # Select group by ir.filters.
        # options['unfolded_lines'] = []
        # options = self._update_multi_selector_filter(options, 'ir_filters', self.groupby_partner_filter.ids)
        # report = report.with_context(report._set_context(options))
        #
        # lines = report._get_lines(options)
        # self.assertLinesValues(
        #     lines,
        #     #                                                   [       Debit       ]   [       Credit      ]   [       Balance     ]
        #     #   Name                                            partner_a   partner_b   partner_a   partner_b   partner_a   partner_b
        #     [   0,                                              1,          2,          3,          4,          5,          6],
        #     [
        #         ('ASSETS',                                      '',         '',         '',         '',         '',         ''),
        #         ('Current Assets',                              '',         '',         '',         '',         '',         ''),
        #         ('Bank and Cash Accounts',                      0.00,       0.00,       0.00,       0.00,       300.00,     -1100.00),
        #         ('Receivables',                                 0.00,       0.00,       0.00,       0.00,       895.00,     245.00),
        #         ('Current Assets',                              0.00,       0.00,       0.00,       0.00,       75.00,      225.00),
        #         ('Prepayments',                                 0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
        #         ('Total Current Assets',                        0.00,       0.00,       0.00,       0.00,       1270.00,    -630.00),
        #         ('Plus Fixed Assets',                           0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
        #         ('Plus Non-current Assets',                     0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
        #         ('Total ASSETS',                                0.00,       0.00,       0.00,       0.00,       1270.00,    -630.00),
        #
        #         ('LIABILITIES',                                 '',         '',         '',         '',         '',         ''),
        #         ('Current Liabilities',                         '',         '',         '',         '',         '',         ''),
        #         ('Current Liabilities',                         0.00,       0.00,       0.00,       0.00,       195.00,     45.00),
        #         ('Payables',                                    0.00,       0.00,       0.00,       0.00,       275.00,     525.00),
        #         ('Total Current Liabilities',                   0.00,       0.00,       0.00,       0.00,       470.00,     570.00),
        #         ('Plus Non-current Liabilities',                0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
        #         ('Total LIABILITIES',                           0.00,       0.00,       0.00,       0.00,       470.00,     570.00),
        #
        #         ('EQUITY',                                      '',         '',         '',         '',         '',         ''),
        #         ('Unallocated Earnings',                        '',         '',         '',         '',         '',         ''),
        #         ('Current Year Unallocated Earnings',           '',         '',         '',         '',         '',         ''),
        #         ('Current Year Earnings',                       0.00,       0.00,       0.00,       0.00,       -400.00,    0.00),
        #         ('Current Year Allocated Earnings',             0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
        #         ('Total Current Year Unallocated Earnings',     0.00,       0.00,       0.00,       0.00,       -400.00,    0.00),
        #         ('Previous Years Unallocated Earnings',         0.00,       0.00,       0.00,       0.00,       1200.00,    -1200.00),
        #         ('Total Unallocated Earnings',                  0.00,       0.00,       0.00,       0.00,       800.00,     -1200.00),
        #         ('Retained Earnings',                           0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
        #         ('Total EQUITY',                                0.00,       0.00,       0.00,       0.00,       800.00,     -1200.00),
        #
        #         ('LIABILITIES + EQUITY',                        0.00,       0.00,       0.00,       0.00,       1270.00,    -630.00),
        #     ],
        # )

    def test_balance_sheet_filter_comparison(self):
        ''' Test folded/unfolded lines with one comparison plus with/without the ir.filters. '''
        # Init options with debit_credit.
        report = self.env.ref('account_reports.account_financial_report_balancesheet0')
        report.applicable_filters_ids = [(6, 0, self.groupby_partner_filter.ids)]
        report = report._with_correct_filters()
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        options = self._update_comparison_filter(options, report, 'previous_period', 1)
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                            Balance     Comparison  %
            [   0,                                              1,          2,          3],
            [
                ('ASSETS',                                      '',         '',         ''),
                ('Current Assets',                              '',         '',         ''),
                ('Bank and Cash Accounts',                      -950.00,    -750.00,    '26.7%'),
                ('Receivables',                                 2075.00,    1485.00,    '39.7%'),
                ('Current Assets',                              705.00,     615.00,     '14.6%'),
                ('Prepayments',                                 0.00,       0.00,       'n/a'),
                ('Total Current Assets',                        1830.00,    1350.00,    '35.6%'),
                ('Plus Fixed Assets',                           0.00,       0.00,       'n/a'),
                ('Plus Non-current Assets',                     0.00,       0.00,       'n/a'),
                ('Total ASSETS',                                1830.00,    1350.00,    '35.6%'),

                ('LIABILITIES',                                 '',         '',         ''),
                ('Current Liabilities',                         '',         '',         ''),
                ('Current Liabilities',                         375.00,     285.00,     '31.6%'),
                ('Payables',                                    3655.00,    3265.00,    '11.9%'),
                ('Total Current Liabilities',                   4030.00,    3550.00,    '13.5%'),
                ('Plus Non-current Liabilities',                0.00,       0.00,       'n/a'),
                ('Total LIABILITIES',                           4030.00,    3550.00,    '13.5%'),

                ('EQUITY',                                      '',         '',         ''),
                ('Unallocated Earnings',                        '',         '',         ''),
                ('Current Year Unallocated Earnings',           '',         '',         ''),
                ('Current Year Earnings',                       200.00,     200.00,     '0.0%'),
                ('Current Year Allocated Earnings',             0.00,       0.00,       'n/a'),
                ('Total Current Year Unallocated Earnings',     200.00,     200.00,     '0.0%'),
                ('Previous Years Unallocated Earnings',         -2400.00,   -2400.00,   '0.0%'),
                ('Total Unallocated Earnings',                  -2200.00,   -2200.00,   '0.0%'),
                ('Retained Earnings',                           0.00,       0.00,       'n/a'),
                ('Total EQUITY',                                -2200.00,   -2200.00,   '0.0%'),

                ('LIABILITIES + EQUITY',                        1830.00,    1350.00,    '35.6%'),
            ],
        )

        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            Balance     Previous Period
            [   0,                                              1,          2],
            [
                ('Receivables',                                 2075.00,    1485.00),
                ('101200 Account Receivable',                   2075.00,    1485.00),
                ('Total Receivables',                           2075.00,    1485.00),
            ],
        )

        # Select both ir.filters.
        options['unfolded_lines'] = []
        options = self._update_multi_selector_filter(options, 'ir_filters', self.groupby_partner_filter.ids)
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #                                                   [                   Balance                 ]   [                  Comparison               ]
            #   Name                                            partner_a   partner_b   partner_c   partner_d   partner_a   partner_b   partner_c   partner_d
            [   0,                                              1,          2,          3,          4,          5,          6,          7,          8],
            [
                ('ASSETS',                                      '',         '',         '',         '',         '',         '',         '',         ''),
                ('Current Assets',                              '',         '',         '',         '',         '',         '',         '',         ''),
                ('Bank and Cash Accounts',                      300.00,     -1100.00,   50.00,      -200.00,    600.00,     -1100.00,   -50.00,     -200.00),
                ('Receivables',                                 895.00,     245.00,     475.00,     460.00,     895.00,     245.00,     230.00,     115.00),
                ('Current Assets',                              75.00,      225.00,     195.00,     210.00,     30.00,      180.00,     195.00,     210.00),
                ('Prepayments',                                 0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
                ('Total Current Assets',                        1270.00,    -630.00,    720.00,     470.00,     1525.00,    -675.00,    375.00,     125.00),
                ('Plus Fixed Assets',                           0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
                ('Plus Non-current Assets',                     0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
                ('Total ASSETS',                                1270.00,    -630.00,    720.00,     470.00,     1525.00,    -675.00,    375.00,     125.00),

                ('LIABILITIES',                                 '',         '',         '',         '',         '',         '',         '',         ''),
                ('Current Liabilities',                         '',         '',         '',         '',         '',         '',         '',         ''),
                ('Current Liabilities',                         195.00,     45.00,      75.00,      60.00,      195.00,     45.00,      30.00,      15.00),
                ('Payables',                                    275.00,     525.00,     1445.00,    1410.00,    230.00,     180.00,     1445.00,    1410.00),
                ('Total Current Liabilities',                   470.00,     570.00,     1520.00,    1470.00,    425.00,     225.00,     1475.00,    1425.00),
                ('Plus Non-current Liabilities',                0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
                ('Total LIABILITIES',                           470.00,     570.00,     1520.00,    1470.00,    425.00,     225.00,     1475.00,    1425.00),

                ('EQUITY',                                      '',         '',         '',         '',         '',         '',         '',         ''),
                ('Unallocated Earnings',                        '',         '',         '',         '',         '',         '',         '',         ''),
                ('Current Year Unallocated Earnings',           '',         '',         '',         '',         '',         '',         '',         ''),
                ('Current Year Earnings',                       -400.00,    0.00,       400.00,     200.00,     -100.00,    300.00,     100.00,     -100.00),
                ('Current Year Allocated Earnings',             0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
                ('Total Current Year Unallocated Earnings',     -400.00,    0.00,       400.00,     200.00,     -100.00,    300.00,     100.00,     -100.00),
                ('Previous Years Unallocated Earnings',         1200.00,    -1200.00,   -1200.00,   -1200.00,   1200.00,    -1200.00,   -1200.00,   -1200.00),
                ('Total Unallocated Earnings',                  800.00,     -1200.00,   -800.00,    -1000.00,   1100.00,    -900.00,    -1100.00,   -1300.00),
                ('Retained Earnings',                           0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00,       0.00),
                ('Total EQUITY',                                800.00,     -1200.00,   -800.00,    -1000.00,   1100.00,    -900.00,    -1100.00,   -1300.00),

                ('LIABILITIES + EQUITY',                        1270.00,    -630.00,    720.00,     470.00,     1525.00,    -675.00,    375.00,     125.00),
            ]
        )


        # Mark the 'Receivables' line to be unfolded.
        line_id = lines[3]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #                                                   [                   Balance                 ]   [                  Comparison               ]
            #   Name                                            partner_a   partner_b   partner_c   partner_d   partner_a   partner_b   partner_c   partner_d
            [   0,                                              1,          2,          3,          4,          5,          6,          7,          8],
            [
                ('Receivables',                                 895.00,     245.00,     475.00,     460.00,     895.00,     245.00,     230.00,     115.00),
                ('101200 Account Receivable',                   895.00,     245.00,     475.00,     460.00,     895.00,     245.00,     230.00,     115.00),
                ('Total Receivables',                           895.00,     245.00,     475.00,     460.00,     895.00,     245.00,     230.00,     115.00),
            ],
        )

    # -------------------------------------------------------------------------
    # TESTS: Profit And Loss
    # -------------------------------------------------------------------------

    def test_profit_and_loss_initial_state(self):
        ''' Test folded/unfolded lines. '''
        # Init options.
        report = self.env.ref('account_reports.account_financial_report_profitandloss0')._with_correct_filters()
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('Income',                                      ''),
                ('Gross Profit',                                ''),
                ('Operating Income',                            600.00),
                ('Cost of Revenue',                             0.00),
                ('Total Gross Profit',                          600.00),
                ('Other Income',                                0.00),
                ('Total Income',                                600.00),
                 ('Expenses',                                    ''),
                ('Expenses',                                    600.00),
                ('Depreciation',                                0.00),
                ('Total Expenses',                              600.00),
                 ('Net Profit',                                 0.00),
            ],
        )

        # Mark the 'Operating Income' line to be unfolded.
        line_id = lines[2]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('Operating Income',                            600.00),
                ('200000 Product Sales',                        600.00),
                ('Total Operating Income',                      600.00),
            ],
        )

    def test_profit_and_loss_filter_journals(self):
        ''' Test folded lines with a filter on journals. '''
        journal = self.env['account.journal'].search([('company_id', '=', self.company_parent.id), ('type', '=', 'sale')])

        # Init options with only the sale journal selected.
        report = self.env.ref('account_reports.account_financial_report_profitandloss0')._with_correct_filters()
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        options = self._update_multi_selector_filter(options, 'journals', journal.ids)
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('Income',                                      ''),
                ('Gross Profit',                                ''),
                ('Operating Income',                            600.00),
                ('Cost of Revenue',                             0.00),
                ('Total Gross Profit',                          600.00),
                ('Other Income',                                0.00),
                ('Total Income',                                600.00),
                 ('Expenses',                                    ''),
                ('Expenses',                                    0.00),
                ('Depreciation',                                0.00),
                ('Total Expenses',                              0.00),
                 ('Net Profit',                                 600.00),
            ],
        )

    # -------------------------------------------------------------------------
    # TESTS: Cash Flow Statement
    # -------------------------------------------------------------------------

    def test_cash_flow_statement_initial_state(self):
        ''' Test folded/unfolded lines. '''
        # Init options.
        report = self.env.ref('account_reports.account_financial_report_cashsummary0')._with_correct_filters()
        options = self._init_options(report, 'custom', *date_utils.get_month(self.mar_year_minus_1))
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                                            Balance
            [   0,                                                              1],
            [
                ('Cash and cash equivalents, beginning of period',              -750.00),
                ('Net increase in cash and cash equivalents',                   ''),
                ('Cash flows from operating activities',                        ''),
                ('Advance Payments received from customers',                    0.00),
                ('Cash received from operating activities',                     86.96),
                ('Advance payments made to suppliers',                          0.00),
                ('Cash paid for operating activities',                          -260.87),
                ('Total Cash flows from operating activities',                  -173.91),
                ('Cash flows from investing & extraordinary activities',        ''),
                ('Cash in',                                                     0.00),
                ('Cash out',                                                    0.00),
                ('Total Cash flows from investing & extraordinary activities',  0.00),
                ('Cash flows from financing activities',                        ''),
                ('Cash in',                                                     0.00),
                ('Cash out',                                                    0.00),
                ('Total Cash flows from financing activities',                  0.00),
                ('Cash flows from unclassified activities',                     ''),
                ('Cash in',                                                     13.04),
                ('Cash out',                                                    -39.13),
                ('Total Cash flows from unclassified activities',               -26.09),
                ('Total Net increase in cash and cash equivalents',             -200.00),
                ('Cash and cash equivalents, closing balance',                  -950.00),
            ],
        )

        # Mark the 'Cash received from operating activities' line to be unfolded.
        line_id = lines[4]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                                            Balance
            [   0,                                                              1],
            [
                ('Cash received from operating activities',                     86.96),
                ('200000 Product Sales',                                        86.96),
                ('Total Cash received from operating activities',               86.96),
            ],
        )

    # -------------------------------------------------------------------------
    # TESTS: Reconciliation Report
    # -------------------------------------------------------------------------

    def test_reconciliation_report_initial_state(self):
        ''' Test the lines of the initial state. '''
        bank_journal = self.env['account.journal'].search([('company_id', '=', self.company_parent.id), ('type', '=', 'bank')])

        # Init options.
        report = self.env['account.bank.reconciliation.report'].with_context(active_id=bank_journal.id)
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                                            Date            Amount
            [   0,                                                              1,              3],
            [
                ('Virtual GL Balance',                                          '',             ''),
                ('Current balance of account 101401',                           '03/31/2017',   -950.00),
                ('Operations to Process',                                       '',             ''),
                ('Unreconciled Bank Statement Lines',                           '',             ''),
                ('CUST.IN/2017/0003',                                           '03/01/2017',   100.00),
                ('Validated Payments not Linked with a Bank Statement Line',    '',             ''),
                ('SUPP.OUT/2017/0003',                                          '03/01/2017',   300.00),
                ('CUST.IN/2017/0003',                                           '03/01/2017',   -100.00),
                ('SUPP.OUT/2017/0002',                                          '02/01/2017',   200.00),
                ('CUST.IN/2017/0001',                                           '01/01/2017',   -600.00),
                ('Total Virtual GL Balance',                                    '',             -1050.00),
                ('Last Bank Statement Ending Balance',                          '03/01/2017',   -1050.00),
                ('Unexplained Difference',                                      '',             ''),
            ],
        )

    def test_reconciliation_report_multi_company_currency(self):
        ''' Test the lines in a multi-company/multi-currency environment. '''
        bank_journal = self.env['account.journal'].search([('company_id', '=', self.company_child_eur.id), ('type', '=', 'bank')])

        # Init options.
        report = self.env['account.bank.reconciliation.report'].with_context(active_id=bank_journal.id)
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                                            Date            Amount
            [   0,                                                              1,              3],
            [
                ('Virtual GL Balance',                                          '',             ''),
                ('Current balance of account 101401',                           '03/31/2017',   -1900.00),
                ('Operations to Process',                                       '',             ''),
                ('Unreconciled Bank Statement Lines',                           '',             ''),
                ('CUST.IN/2017/0007',                                           '03/01/2017',   200.00),
                ('Validated Payments not Linked with a Bank Statement Line',    '',             ''),
                ('SUPP.OUT/2017/0006',                                          '03/01/2017',   600.00),
                ('CUST.IN/2017/0007',                                           '03/01/2017',   -200.00),
                ('SUPP.OUT/2017/0005',                                          '02/01/2017',   400.00),
                ('CUST.IN/2017/0005',                                           '01/01/2017',   -1200.00),
                ('Total Virtual GL Balance',                                    '',             -2100.00),
                ('Last Bank Statement Ending Balance',                          '03/01/2017',   -2100.00),
                ('Unexplained Difference',                                      '',             ''),
            ],
            currency=self.company_child_eur.currency_id,
        )

    def test_reconciliation_report_journal_foreign_currency(self):
        ''' Test the lines with a foreign currency on the journal. '''
        bank_journal = self.env['account.journal'].search([('company_id', '=', self.company_parent.id), ('type', '=', 'bank')])
        foreign_currency = self.env.ref('base.EUR')

        # Set up the foreign currency.
        bank_journal_eur = bank_journal.copy()
        account = bank_journal.default_debit_account_id.copy()
        account.currency_id = foreign_currency
        bank_journal_eur.default_debit_account_id = bank_journal_eur.default_credit_account_id = account
        bank_journal_eur.currency_id = foreign_currency

        invoice = self._create_invoice(self.env, 1000.0, self.partner_a, 'out_invoice', self.mar_year_minus_1)
        payment = self._create_payment(self.env, self.mar_year_minus_1, invoice, 1000.0, journal=bank_journal_eur)
        self._create_bank_statement(self.env, payment, amount=2300.00, reconcile=False)

        # Init options.
        report = self.env['account.bank.reconciliation.report'].with_context(active_id=bank_journal_eur.id)
        options = self._init_options(report, 'custom', date_utils.get_month(self.mar_year_minus_1)[1])
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                                            Date            Amount
            [   0,                                                              1,              3],
            [
                ('Virtual GL Balance',                                          '',             ''),
                ('Current balance of account 101411',                           '03/31/2017',   2300.00),
                ('Operations to Process',                                       '',             ''),
                ('Unreconciled Bank Statement Lines',                           '',             ''),
                ('CUST.IN/2017/0009',                                           '03/01/2017',   2300.00),
                ('Validated Payments not Linked with a Bank Statement Line',    '',             ''),
                ('CUST.IN/2017/0009',                                           '03/01/2017',   -2300.00),
                ('Total Virtual GL Balance',                                    '',             2300.00),
                ('Last Bank Statement Ending Balance',                          '03/01/2017',   2300.00),
                ('Unexplained Difference',                                      '',             ''),
            ],
            currency=foreign_currency,
        )

    # -------------------------------------------------------------------------
    # TESTS: Consolidated Journals
    # -------------------------------------------------------------------------

    def test_consolidated_journals_folded_unfolded(self):
        ''' Test folded/unfolded lines. '''
        # Init options.
        report = self.env['account.consolidated.journal']
        options = self._init_options(report, 'custom', *date_utils.get_quarter(self.mar_year_minus_1))
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Debit           Credit          Balance
            [   0,                                      1,              2,              3],
            [
                ('Customer Invoices (INV)',             1495.00,        1495.00,        0.00),
                ('Vendor Bills (BILL)',                 1265.00,        1265.00,        0.00),
                ('Bank (BNK1)',                         1350.00,        1350.00,        0.00),
                ('Total',                               4110.00,        4110.00,        0.00),
                ('',                                    '',             '',             ''),
                ('Details per month',                   '',             '',             ''),
                ('Jan 2017',                            1160.00,        1160.00,        0.00),
                ('Feb 2017',                            1170.00,        1170.00,        0.00),
                ('Mar 2017',                            1780.00,        1780.00,        0.00),
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
                ('101200 Account Receivable',           1495.00,        0.00,           1495.00),
                ('111200 Tax Received',                 0.00,           195.00,         -195.00),
                ('200000 Product Sales',                0.00,           1300.00,        -1300.00),
            ],
        )

        # Mark the '101200 Account Receivable' line to be unfolded.
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
        options = self._init_options(report, 'custom', *date_utils.get_quarter(self.mar_year_minus_1))
        options = self._update_multi_selector_filter(options, 'journals', bank_journal.ids)
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                                    Debit           Credit          Balance
            [   0,                                      1,              2,              3],
            [
                ('Bank (BNK1)',                         1350.00,        1350.00,        0.00),
                ('Total',                               1350.00,        1350.00,        0.00),
                ('',                                    '',             '',             ''),
                ('Details per month',                   '',             '',             ''),
                ('Jan 2017',                            700.00,         700.00,         0.00),
                ('Feb 2017',                            250.00,         250.00,         0.00),
                ('Mar 2017',                            400.00,         400.00,         0.00),
            ],
        )

        # Mark the 'Bank (BNK1)' line to be unfolded.
        line_id = lines[0]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        lines = report._get_lines(options, line_id=line_id)
        self.assertLinesValues(
            lines,
            #   Name                                    Debit           Credit          Balance
            [   0,                                      1,              2,              3],
            [
                ('Bank (BNK1)',                         1350.00,        1350.00,        0.00),
                ('101200 Account Receivable',           0.00,           800.00,         -800.00),
                ('101401 Bank',                         800.00,         550.00,         250.00),
                ('111100 Account Payable',              550.00,         0.00,           550.00),
            ],
        )

        # Mark the '101200 Account Receivable' line to be unfolded.
        line_id = lines[1]['id']
        options['unfolded_lines'] = [line_id]
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Debit           Credit          Balance
            [   0,                                      1,              2,              3],
            [
                ('Jan 2017',                            0.00,           700.00,         -700.00),
                ('Mar 2017',                            0.00,           100.00,         -100.00),
            ],
        )

    # -------------------------------------------------------------------------
    # TESTS: Followup Report
    # -------------------------------------------------------------------------

    def test_followup_report_initial_state(self):
        ''' Test folded/unfolded lines. '''
        # Init options.
        report = self.env['account.followup.report']
        options = report._get_options(None)
        options['partner_id'] = self.partner_a.id
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options)[:-1],
            #   Name                                    Date,           Due Date,       Doc.    Comm.   Exp. Date   Blocked             Total Due
            [   0,                                      1,              2,              3,      4,      5,          6,                  7],
            [
                ('INV/2017/0001',                       '01/01/2017',   '01/01/2017',   '',     '',     '',         '',                 115.00),
                ('INV/2016/0001',                       '12/01/2016',   '12/01/2016',   '',     '',     '',         '',                 780.00),
                ('',                                    '',             '',             '',     '',     '',         'Total Due',        895.00),
                ('',                                    '',             '',             '',     '',     '',         'Total Overdue',    895.00),
            ],
        )
