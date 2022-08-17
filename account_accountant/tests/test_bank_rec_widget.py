# -*- coding: utf-8 -*-
from odoo.addons.account_accountant.tests.test_bank_rec_widget_common import TestBankRecWidgetCommon, WizardForm
from odoo.exceptions import UserError
from odoo.tests import tagged
from odoo.tools import html2plaintext
from odoo import fields, Command

from freezegun import freeze_time
import re


@tagged('post_install', '-at_install')
class TestBankRecWidget(TestBankRecWidgetCommon):

    def assert_form_extra_text_value(self, value, regex):
        if regex:
            cleaned_value = html2plaintext(value).replace('\n', '')
            if not re.match(regex, cleaned_value):
                self.fail(f"The following 'form_extra_text':\n\n'{cleaned_value}'\n\n...doesn't match the provided regex:\n\n'{regex}'")
        else:
            self.assertFalse(value)

    def test_retrieve_partner_from_account_number(self):
        st_line = self._create_st_line(1000.0, partner_id=None, account_number="014 474 8555")
        bank_account = self.env['res.partner.bank'].create({
            'acc_number': '0144748555',
            'partner_id': self.partner_a.id,
        })
        self.assertEqual(st_line._retrieve_partner(), bank_account.partner_id)

        # Can't retrieve the partner since the bank account is used by multiple partners.
        self.env['res.partner.bank'].create({
            'acc_number': '0144748555',
            'partner_id': self.partner_b.id,
        })
        self.assertEqual(st_line._retrieve_partner(), self.env['res.partner'])

    def test_retrieve_partner_from_payment_ref(self):
        st_line = self._create_st_line(1000.0, partner_id=None, payment_ref="Gagnant turlututu Bernard tsoin tsoin")
        partner = self.env['res.partner'].create({'name': "Bernard Gagnant"})

        self.assertEqual(st_line._retrieve_partner(), partner)

    def test_validation_new_aml_same_foreign_currency(self):
        # 6000.0 curr2 == 1200.0 comp_curr (bank rate 5:1 instead of the odoo rate 4:1)
        st_line = self._create_st_line(
            1200.0,
            date='2017-01-01',
            foreign_currency_id=self.currency_data_2['currency'].id,
            amount_currency=6000.0,
        )
        # 6000.0 curr2 == 1000.0 comp_curr (rate 6:1)
        inv_line = self._create_invoice_line(
            6000.0, self.partner_a, 'out_invoice',
            currency=self.currency_data_2['currency'],
            inv_date='2016-01-01',
        )

        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        wizard._action_add_new_amls(inv_line)
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'new_aml',     'amount_currency': -6000.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0},
        ])
        self.assertRecordValues(wizard, [{'state': 'valid'}])

        # The amount is the same, no message under the 'amount' field.
        self.assert_form_extra_text_value(wizard.form_extra_text, False)

        wizard.button_validate(async_action=False)
        self.assertRecordValues(st_line.line_ids, [
            # pylint: disable=C0326
            {'account_id': st_line.journal_id.default_account_id.id,    'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0,  'reconciled': False},
            {'account_id': inv_line.account_id.id,                      'amount_currency': -6000.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0, 'reconciled': True},
        ])
        self.assertRecordValues(st_line, [{'is_reconciled': True}])
        self.assertRecordValues(inv_line.move_id, [{'payment_state': 'paid'}])

        # Reset the wizard.
        wizard.button_reset()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'auto_balance',    'amount_currency': -6000.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0},
        ])

        # Create the same invoice with a higher amount to check the partial flow.
        # 9000.0 curr2 == 1500.0 comp_curr (rate 6:1)
        inv_line = self._create_invoice_line(
            9000.0, self.partner_a, 'out_invoice',
            currency=self.currency_data_2['currency'],
            inv_date='2016-01-01',
        )
        wizard._action_add_new_amls(inv_line)
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'new_aml',     'amount_currency': -6000.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0},
        ])

        # Check the message under the 'amount' field.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'new_aml')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        wizard = form.save()
        self.assert_form_extra_text_value(
            wizard.form_extra_text,
            r".+open amount of 9,000.000.+ reduced by 6,000.000.+ set the invoice as fully paid .",
        )
        self.assertRecordValues(wizard, [{
            'form_suggest_amount_currency': 9000.0,
            'form_suggest_balance': 1800.0,
        }])

        # Switch to a full reconciliation.
        form = WizardForm(wizard)
        form.todo_command = 'button_clicked,button_form_apply_suggestion'
        wizard = form.save()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'new_aml',         'amount_currency': -9000.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1800.0},
            {'flag': 'auto_balance',    'amount_currency': 3000.0,      'currency_id': self.currency_data_2['currency'].id, 'balance': 600.0},
        ])

        # Check the message under the 'amount' field.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'new_aml')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        wizard = form.save()
        self.assert_form_extra_text_value(
            wizard.form_extra_text,
            r".+open amount of 9,000.000.+ paid .+ record a partial payment .",
        )
        self.assertRecordValues(wizard, [{
            'form_suggest_amount_currency': 6000.0,
            'form_suggest_balance': 1200.0,
        }])

        # Switch back to a partial reconciliation.
        form = WizardForm(wizard)
        form.todo_command = 'button_clicked,button_form_apply_suggestion'
        wizard = form.save()
        self.assertRecordValues(wizard, [{'state': 'valid'}])

        # Reconcile
        wizard.button_validate(async_action=False)
        self.assertRecordValues(st_line.line_ids, [
            # pylint: disable=C0326
            {'account_id': st_line.journal_id.default_account_id.id,    'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0,  'reconciled': False},
            {'account_id': inv_line.account_id.id,                      'amount_currency': -6000.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0, 'reconciled': True},
        ])
        self.assertRecordValues(st_line, [{'is_reconciled': True}])
        self.assertRecordValues(inv_line.move_id, [{
            'payment_state': 'partial',
            'amount_residual': 3000.0,
        }])

    def test_validation_new_aml_one_foreign_currency_on_st_line(self):
        # 4800.0 curr2 == 1200.0 comp_curr (rate 4:1)
        st_line = self._create_st_line(
            1200.0,
            date='2017-01-01',
            foreign_currency_id=self.currency_data_2['currency'].id,
            amount_currency=4800.0,
        )
        # 800.0 comp_curr is equals to 4800.0 curr2 in 2016 (rate 6:1)
        inv_line = self._create_invoice_line(
            800.0, self.partner_a, 'out_invoice',
            inv_date='2016-01-01',
        )

        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        wizard._action_add_new_amls(inv_line)
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'new_aml',     'amount_currency': -4800.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0},
        ])
        self.assertRecordValues(wizard, [{'state': 'valid'}])

        # The amount is the same, no message under the 'amount' field.
        self.assert_form_extra_text_value(wizard.form_extra_text, False)

        wizard.button_validate(async_action=False)
        self.assertRecordValues(st_line.line_ids, [
            # pylint: disable=C0326
            {'account_id': st_line.journal_id.default_account_id.id,    'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0,  'reconciled': False},
            {'account_id': inv_line.account_id.id,                      'amount_currency': -4800.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0, 'reconciled': True},
        ])
        self.assertRecordValues(st_line, [{'is_reconciled': True}])
        self.assertRecordValues(inv_line.move_id, [{'payment_state': 'paid'}])

        # Reset the wizard.
        wizard.button_reset()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'auto_balance',    'amount_currency': -4800.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0},
        ])

        # Create the same invoice with a higher amount to check the partial flow.
        # 1200.0 comp_curr is equals to 7200.0 curr2 in 2016 (rate 6:1)
        inv_line = self._create_invoice_line(
            1200.0, self.partner_a, 'out_invoice',
            inv_date='2016-01-01',
        )
        wizard._action_add_new_amls(inv_line)
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'new_aml',     'amount_currency': -4800.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0},
        ])

        # Check the message under the 'amount' field.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'new_aml')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        wizard = form.save()
        self.assert_form_extra_text_value(
            wizard.form_extra_text,
            r".+open amount of .+1,200.00.+ reduced by .+800.00.+ set the invoice as fully paid .",
        )
        self.assertRecordValues(wizard, [{
            'form_suggest_amount_currency': 7200.0,
            'form_suggest_balance': 1800.0,
        }])

        # Switch to a full reconciliation.
        form = WizardForm(wizard)
        form.todo_command = 'button_clicked,button_form_apply_suggestion'
        wizard = form.save()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'new_aml',         'amount_currency': -7200.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1800.0},
            {'flag': 'auto_balance',    'amount_currency': 2400.0,      'currency_id': self.currency_data_2['currency'].id, 'balance': 600.0},
        ])

        # Check the message under the 'amount' field.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'new_aml')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        wizard = form.save()
        self.assert_form_extra_text_value(
            wizard.form_extra_text,
            r".+open amount of .+1,200.00.+ paid .+ record a partial payment .",
        )
        self.assertRecordValues(wizard, [{
            'form_suggest_amount_currency': 4800.0,
            'form_suggest_balance': 1200.0,
        }])

        # Switch back to a partial reconciliation.
        form = WizardForm(wizard)
        form.todo_command = 'button_clicked,button_form_apply_suggestion'
        wizard = form.save()
        self.assertRecordValues(wizard, [{'state': 'valid'}])

        # Reconcile
        wizard.button_validate(async_action=False)
        self.assertRecordValues(st_line.line_ids, [
            # pylint: disable=C0326
            {'account_id': st_line.journal_id.default_account_id.id,    'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0,  'reconciled': False},
            {'account_id': inv_line.account_id.id,                      'amount_currency': -4800.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0, 'reconciled': True},
        ])
        self.assertRecordValues(st_line, [{'is_reconciled': True}])
        self.assertRecordValues(inv_line.move_id, [{
            'payment_state': 'partial',
            'amount_residual': 400.0,
        }])

    def test_validation_new_aml_one_foreign_currency_on_inv_line(self):
        # 1200.0 comp_curr is equals to 4800.0 curr2 in 2017 (rate 4:1)
        st_line = self._create_st_line(
            1200.0,
            date='2017-01-01',
        )
        # 4800.0 curr2 == 800.0 comp_curr (rate 6:1)
        inv_line = self._create_invoice_line(
            4800.0, self.partner_a, 'out_invoice',
            currency=self.currency_data_2['currency'],
            inv_date='2016-01-01',
        )

        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        wizard._action_add_new_amls(inv_line)
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'new_aml',     'amount_currency': -4800.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0},
        ])
        self.assertRecordValues(wizard, [{'state': 'valid'}])

        # The amount is the same, no message under the 'amount' field.
        self.assert_form_extra_text_value(wizard.form_extra_text, False)

        wizard.button_validate(async_action=False)
        self.assertRecordValues(st_line.line_ids, [
            # pylint: disable=C0326
            {'account_id': st_line.journal_id.default_account_id.id,    'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0,  'reconciled': False},
            {'account_id': inv_line.account_id.id,                      'amount_currency': -4800.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0, 'reconciled': True},
        ])
        self.assertRecordValues(st_line, [{'is_reconciled': True}])
        self.assertRecordValues(inv_line.move_id, [{'payment_state': 'paid'}])

        # Reset the wizard.
        wizard.button_reset()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'auto_balance',    'amount_currency': -1200.0,     'currency_id': self.company_data['currency'].id,    'balance': -1200.0},
        ])

        # Create the same invoice with a higher amount to check the partial flow.
        # 7200.0 curr2 == 1200.0 comp_curr (rate 6:1)
        inv_line = self._create_invoice_line(
            7200.0, self.partner_a, 'out_invoice',
            currency=self.currency_data_2['currency'],
            inv_date='2016-01-01',
        )
        wizard._action_add_new_amls(inv_line)
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'new_aml',     'amount_currency': -4800.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0},
        ])

        # Check the message under the 'amount' field.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'new_aml')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        wizard = form.save()
        self.assert_form_extra_text_value(
            wizard.form_extra_text,
            r".+open amount of 7,200.000.+ reduced by 4,800.000.+ set the invoice as fully paid .",
        )
        self.assertRecordValues(wizard, [{
            'form_suggest_amount_currency': 7200.0,
            'form_suggest_balance': 1800.0,
        }])

        # Switch to a full reconciliation.
        form = WizardForm(wizard)
        form.todo_command = 'button_clicked,button_form_apply_suggestion'
        wizard = form.save()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0},
            {'flag': 'new_aml',         'amount_currency': -7200.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1800.0},
            {'flag': 'auto_balance',    'amount_currency': 600.0,       'currency_id': self.company_data['currency'].id,    'balance': 600.0},
        ])

        # Check the message under the 'amount' field.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'new_aml')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        wizard = form.save()
        self.assert_form_extra_text_value(
            wizard.form_extra_text,
            r".+open amount of 7,200.000.+ paid .+ record a partial payment .",
        )
        self.assertRecordValues(wizard, [{
            'form_suggest_amount_currency': 4800.0,
            'form_suggest_balance': 1200.0,
        }])

        # Switch back to a partial reconciliation.
        form = WizardForm(wizard)
        form.todo_command = 'button_clicked,button_form_apply_suggestion'
        wizard = form.save()
        self.assertRecordValues(wizard, [{'state': 'valid'}])

        # Reconcile
        wizard.button_validate(async_action=False)
        self.assertRecordValues(st_line.line_ids, [
            # pylint: disable=C0326
            {'account_id': st_line.journal_id.default_account_id.id,    'amount_currency': 1200.0,      'currency_id': self.company_data['currency'].id,    'balance': 1200.0,  'reconciled': False},
            {'account_id': inv_line.account_id.id,                      'amount_currency': -4800.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0, 'reconciled': True},
        ])
        self.assertRecordValues(st_line, [{'is_reconciled': True}])
        self.assertRecordValues(inv_line.move_id, [{
            'payment_state': 'partial',
            'amount_residual': 2400.0,
        }])

    def test_validation_new_aml_multi_currencies(self):
        # 6300.0 curr2 == 1800.0 comp_curr (bank rate 3.5:1 instead of the odoo rate 4:1)
        st_line = self._create_st_line(
            1800.0,
            date='2017-01-01',
            foreign_currency_id=self.currency_data_2['currency'].id,
            amount_currency=6300.0,
        )
        # 21600.0 curr3 == 1800.0 comp_curr (rate 12:1)
        inv_line = self._create_invoice_line(
            21600.0, self.partner_a, 'out_invoice',
            currency=self.currency_data_3['currency'],
            inv_date='2016-01-01',
        )

        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        wizard._action_add_new_amls(inv_line)
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'amount_currency': 1800.0,      'currency_id': self.company_data['currency'].id,    'balance': 1800.0},
            {'flag': 'new_aml',     'amount_currency': -21600.0,    'currency_id': self.currency_data_3['currency'].id, 'balance': -1800.0},
        ])
        self.assertRecordValues(wizard, [{'state': 'valid'}])

        # The amount is the same, no message under the 'amount' field.
        self.assert_form_extra_text_value(wizard.form_extra_text, False)

        wizard.button_validate(async_action=False)
        self.assertRecordValues(st_line.line_ids, [
            # pylint: disable=C0326
            {'account_id': st_line.journal_id.default_account_id.id,    'amount_currency': 1800.0,      'currency_id': self.company_data['currency'].id,    'balance': 1800.0,  'reconciled': False},
            {'account_id': inv_line.account_id.id,                      'amount_currency': -21600.0,    'currency_id': self.currency_data_3['currency'].id, 'balance': -1800.0, 'reconciled': True},
        ])
        self.assertRecordValues(st_line, [{'is_reconciled': True}])
        self.assertRecordValues(inv_line.move_id, [{'payment_state': 'paid'}])

        # Reset the wizard.
        wizard.button_reset()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1800.0,      'currency_id': self.company_data['currency'].id,    'balance': 1800.0},
            {'flag': 'auto_balance',    'amount_currency': -6300.0,     'currency_id': self.currency_data_2['currency'].id, 'balance': -1800.0},
        ])

        # Create the same invoice with a higher amount to check the partial flow.
        # 32400.0 curr3 == 2700.0 comp_curr (rate 12:1)
        inv_line = self._create_invoice_line(
            32400.0, self.partner_a, 'out_invoice',
            currency=self.currency_data_3['currency'],
            inv_date='2016-01-01',
        )
        wizard._action_add_new_amls(inv_line)
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'amount_currency': 1800.0,      'currency_id': self.company_data['currency'].id,    'balance': 1800.0},
            {'flag': 'new_aml',     'amount_currency': -21600.0,    'currency_id': self.currency_data_3['currency'].id, 'balance': -1800.0},
        ])

        # Check the message under the 'amount' field.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'new_aml')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        wizard = form.save()
        self.assert_form_extra_text_value(
            wizard.form_extra_text,
            r".+open amount of 32,400.000.+ reduced by 21,600.000.+ set the invoice as fully paid .",
        )
        self.assertRecordValues(wizard, [{
            'form_suggest_amount_currency': 32400.0,
            'form_suggest_balance': 2700.0,
        }])

        # Switch to a full reconciliation.
        form = WizardForm(wizard)
        form.todo_command = 'button_clicked,button_form_apply_suggestion'
        wizard = form.save()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1800.0,      'currency_id': self.company_data['currency'].id,    'balance': 1800.0},
            {'flag': 'new_aml',         'amount_currency': -32400.0,    'currency_id': self.currency_data_3['currency'].id, 'balance': -2700.0},
            {'flag': 'auto_balance',    'amount_currency': 3150.0,      'currency_id': self.currency_data_2['currency'].id, 'balance': 900.0},
        ])

        # Check the message under the 'amount' field.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'new_aml')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        wizard = form.save()
        self.assert_form_extra_text_value(
            wizard.form_extra_text,
            r".+open amount of 32,400.000.+ paid .+ record a partial payment .",
        )
        self.assertRecordValues(wizard, [{
            'form_suggest_amount_currency': 21600.0,
            'form_suggest_balance': 1800.0,
        }])

        # Switch back to a partial reconciliation.
        form = WizardForm(wizard)
        form.todo_command = 'button_clicked,button_form_apply_suggestion'
        wizard = form.save()
        self.assertRecordValues(wizard, [{'state': 'valid'}])

        # Reconcile
        wizard.button_validate(async_action=False)
        self.assertRecordValues(st_line.line_ids, [
            # pylint: disable=C0326
            {'account_id': st_line.journal_id.default_account_id.id,    'amount_currency': 1800.0,      'currency_id': self.company_data['currency'].id,    'balance': 1800.0,  'reconciled': False},
            {'account_id': inv_line.account_id.id,                      'amount_currency': -21600.0,    'currency_id': self.currency_data_3['currency'].id, 'balance': -1800.0, 'reconciled': True},
        ])
        self.assertRecordValues(st_line, [{'is_reconciled': True}])
        self.assertRecordValues(inv_line.move_id, [{
            'payment_state': 'partial',
            'amount_residual': 10800.0,
        }])

    def test_validation_with_partner(self):
        partner = self.partner_a.copy()

        st_line = self._create_st_line(1000.0, partner_id=self.partner_a.id)

        # The wizard can be validated directly thanks to the receivable account set on the partner.
        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        self.assertRecordValues(wizard, [{'state': 'valid'}])

        # Validate and check the statement line.
        wizard.button_validate(async_action=False)
        liquidity_line, _suspense_line, other_line = st_line._seek_for_lines()
        account = self.partner_a.property_account_receivable_id
        self.assertRecordValues(liquidity_line + other_line, [
            # pylint: disable=C0326
            {'account_id': liquidity_line.account_id.id,    'balance': 1000.0},
            {'account_id': account.id,                      'balance': -1000.0},
        ])
        self.assertRecordValues(wizard, [{'state': 'reconciled'}])

        # Match an invoice with a different partner.
        wizard.button_reset()
        inv_line = self._create_invoice_line(1000.0, partner, 'out_invoice')
        wizard._action_add_new_amls(inv_line)
        wizard.button_validate(async_action=False)
        liquidity_line, _suspense_line, other_line = st_line._seek_for_lines()
        self.assertRecordValues(st_line, [{'partner_id': partner.id}])
        self.assertRecordValues(liquidity_line + other_line, [
            # pylint: disable=C0326
            {'account_id': liquidity_line.account_id.id,    'partner_id': partner.id,   'balance': 1000.0},
            {'account_id': inv_line.account_id.id,          'partner_id': partner.id,   'balance': -1000.0},
        ])
        self.assertRecordValues(wizard, [{'state': 'reconciled'}])

        # Reset the wizard and match invoices with different partners.
        wizard.button_reset()
        partner1 = self.partner_a.copy()
        inv_line1 = self._create_invoice_line(300.0, partner1, 'out_invoice')
        partner2 = self.partner_a.copy()
        inv_line2 = self._create_invoice_line(300.0, partner2, 'out_invoice')
        wizard._action_add_new_amls(inv_line1 + inv_line2)
        wizard.button_validate(async_action=False)
        liquidity_line, _suspense_line, other_line = st_line._seek_for_lines()
        self.assertRecordValues(st_line, [{'partner_id': False}])
        self.assertRecordValues(liquidity_line + other_line, [
            # pylint: disable=C0326
            {'account_id': liquidity_line.account_id.id,    'partner_id': False,        'balance': 1000.0},
            {'account_id': inv_line1.account_id.id,         'partner_id': partner1.id,  'balance': -300.0},
            {'account_id': inv_line2.account_id.id,         'partner_id': partner2.id,  'balance': -300.0},
            {'account_id': account.id,                      'partner_id': False,        'balance': -400.0},
        ])
        self.assertRecordValues(wizard, [{'state': 'reconciled'}])

    def test_validation_using_custom_account(self):
        st_line = self._create_st_line(1000.0)

        # By default, the wizard can't be validated directly due to the suspense account.
        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        self.assertRecordValues(wizard, [{'state': 'invalid'}])

        # Mount the auto-balance line in edit mode.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'auto_balance')
        wizard._action_mount_line_in_edit(line.index)
        liquidity_line, suspense_line, _other_lines = st_line._seek_for_lines()
        self.assertRecordValues(wizard, [{
            'form_index': line.index,
            'form_account_id': suspense_line.account_id.id,
            'form_balance': -1000.0,
        }])

        # Switch to a custom account.
        account = self.env['account.account'].create({
            'name': "test_validation_using_custom_account",
            'code': "424242",
            'account_type': "asset_current",
        })
        form = WizardForm(wizard)
        form.form_account_id = account
        wizard = form.save()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'account_id': liquidity_line.account_id.id, 'balance': 1000.0},
            {'flag': 'manual',      'account_id': account.id,                   'balance': -1000.0},
        ])

        # The wizard can be validated.
        self.assertRecordValues(wizard, [{'state': 'valid'}])

        # Validate and check the statement line.
        wizard.button_validate(async_action=False)
        liquidity_line, _suspense_line, other_line = st_line._seek_for_lines()
        self.assertRecordValues(liquidity_line + other_line, [
            # pylint: disable=C0326
            {'account_id': liquidity_line.account_id.id,    'balance': 1000.0},
            {'account_id': account.id,                      'balance': -1000.0},
        ])
        self.assertRecordValues(wizard, [{'state': 'reconciled'}])

    def test_validation_with_taxes(self):
        st_line = self._create_st_line(1000.0)

        tax_tags = self.env['account.account.tag'].create({
            'name': f'tax_tag_{i}',
            'applicability': 'taxes',
            'country_id': self.env.company.account_fiscal_country_id.id,
        } for i in range(4))

        tax_21 = self.env['account.tax'].create({
            'name': "tax_21",
            'amount': 21,
            'invoice_repartition_line_ids': [
                Command.create({
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'tag_ids': [Command.set(tax_tags[0].ids)],
                }),
                Command.create({
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'tag_ids': [Command.set(tax_tags[1].ids)],
                }),
            ],
            'refund_repartition_line_ids': [
                Command.create({
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'tag_ids': [Command.set(tax_tags[2].ids)],
                }),
                Command.create({
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'tag_ids': [Command.set(tax_tags[3].ids)],
                }),
            ],
        })

        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        line = wizard.line_ids.filtered(lambda x: x.flag == 'auto_balance')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        form.form_tax_ids.add(tax_21)
        wizard = form.save()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'balance': 1000.0,  'tax_tag_ids': []},
            {'flag': 'manual',      'balance': -826.45, 'tax_tag_ids': tax_tags[0].ids},
            {'flag': 'tax_line',    'balance': -173.55, 'tax_tag_ids': tax_tags[1].ids},
        ])

        # Edit the base line. The tax tags should be the refund ones.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'manual')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        form.form_balance = 500.0
        wizard = form.save()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,      'tax_tag_ids': []},
            {'flag': 'manual',          'balance': 500.0,       'tax_tag_ids': tax_tags[2].ids},
            {'flag': 'tax_line',        'balance': 105.0,       'tax_tag_ids': tax_tags[3].ids},
            {'flag': 'auto_balance',    'balance': -1605.0,     'tax_tag_ids': []},
        ])

        # Edit the base line.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'manual')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        form.form_balance = -500.0
        wizard = form.save()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,  'tax_tag_ids': []},
            {'flag': 'manual',          'balance': -500.0,  'tax_tag_ids': tax_tags[0].ids},
            {'flag': 'tax_line',        'balance': -105.0,  'tax_tag_ids': tax_tags[1].ids},
            {'flag': 'auto_balance',    'balance': -395.0,  'tax_tag_ids': []},
        ])

        # Edit the tax line.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'tax_line')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        form.form_balance = -100.0
        wizard = form.save()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,  'tax_tag_ids': []},
            {'flag': 'manual',          'balance': -500.0,  'tax_tag_ids': tax_tags[0].ids},
            {'flag': 'tax_line',        'balance': -100.0,  'tax_tag_ids': tax_tags[1].ids},
            {'flag': 'auto_balance',    'balance': -400.0,  'tax_tag_ids': []},
        ])

        # Add a new tax.
        tax_10 = self.env['account.tax'].create({
            'name': "tax_10",
            'amount': 10,
        })

        line = wizard.line_ids.filtered(lambda x: x.flag == 'manual')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        form.form_tax_ids.add(tax_10)
        wizard = form.save()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0},
            {'flag': 'manual',          'balance': -500.0},
            {'flag': 'tax_line',        'balance': -105.0},
            {'flag': 'tax_line',        'balance': -50.0},
            {'flag': 'auto_balance',    'balance': -345.0},
        ])

        # Remove the taxes.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'manual')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        form.form_tax_ids.clear()
        wizard = form.save()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0},
            {'flag': 'manual',          'balance': -500.0},
            {'flag': 'auto_balance',    'balance': -500.0},
        ])

        # Reset the amount.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'manual')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        form.form_balance = -1000.0
        wizard = form.save()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0},
            {'flag': 'manual',          'balance': -1000.0},
        ])

        # Add taxes. We should be back into the "price included taxes" mode.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'manual')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        form.form_tax_ids.add(tax_21)
        wizard = form.save()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'balance': 1000.0},
            {'flag': 'manual',      'balance': -826.45},
            {'flag': 'tax_line',    'balance': -173.55},
        ])

        line = wizard.line_ids.filtered(lambda x: x.flag == 'manual')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        form.form_tax_ids.add(tax_10)
        wizard = form.save()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'balance': 1000.0},
            {'flag': 'manual',      'balance': -763.36},
            {'flag': 'tax_line',    'balance': -160.31},
            {'flag': 'tax_line',    'balance': -76.33},
        ])

        # Changing the account should recompute the taxes but preserve the "price included taxes" mode.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'manual')
        form = WizardForm(wizard)
        form.todo_command = f'mount_line_in_edit,{line.index}'
        form.form_account_id = self.company_data['default_account_revenue']
        wizard = form.save()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'balance': 1000.0},
            {'flag': 'manual',      'balance': -763.36},
            {'flag': 'tax_line',    'balance': -160.31},
            {'flag': 'tax_line',    'balance': -76.33},
        ])

        # The wizard can be validated.
        self.assertRecordValues(wizard, [{'state': 'valid'}])

        # Validate and check the statement line.
        wizard.button_validate(async_action=False)
        self.assertRecordValues(st_line.line_ids, [
            # pylint: disable=C0326
            {'balance': 1000.0},
            {'balance': -763.36},
            {'balance': -160.31},
            {'balance': -76.33},
        ])
        self.assertRecordValues(wizard, [{'state': 'reconciled'}])

    def test_apply_taxes_with_reco_model(self):
        st_line = self._create_st_line(1000.0)

        tax_21 = self.env['account.tax'].create({
            'name': "tax_21",
            'amount': 21,
        })

        reco_model = self.env['account.reconcile.model'].create({
            'name': "test_apply_taxes_with_reco_model",
            'rule_type': 'writeoff_button',
            'line_ids': [Command.create({
                'account_id': self.company_data['default_account_revenue'].id,
                'tax_ids': [Command.set(tax_21.ids)],
            })],
        })

        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        wizard._action_select_reconcile_model(reco_model)

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',   'balance': 1000.0},
            {'flag': 'manual',      'balance': -826.45},
            {'flag': 'tax_line',    'balance': -173.55},
        ])

    def test_creating_manual_line_multi_currencies(self):
        # 6300.0 curr2 == 1800.0 comp_curr (bank rate 3.5:1 instead of the odoo rate 4:1)
        st_line = self._create_st_line(
            1800.0,
            date='2017-01-01',
            foreign_currency_id=self.currency_data_2['currency'].id,
            amount_currency=6300.0,
        )

        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1800.0,  'currency_id': self.company_data['currency'].id,    'balance': 1800.0},
            {'flag': 'auto_balance',    'amount_currency': -6300.0, 'currency_id': self.currency_data_2['currency'].id, 'balance': -1800.0},
        ])

        # Custom balance.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'auto_balance')
        wizard._action_mount_line_in_edit(line.index)
        form = WizardForm(wizard)
        form.form_balance = -1500.0
        wizard = form.save()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1800.0,  'currency_id': self.company_data['currency'].id,    'balance': 1800.0},
            {'flag': 'manual',          'amount_currency': -6300.0, 'currency_id': self.currency_data_2['currency'].id, 'balance': -1500.0},
            {'flag': 'auto_balance',    'amount_currency': -1050.0, 'currency_id': self.currency_data_2['currency'].id, 'balance': -300.0},
        ])

        # Custom amount_currency.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'manual')
        wizard._action_mount_line_in_edit(line.index)
        form = WizardForm(wizard)
        form.form_amount_currency = -4200.0
        wizard = form.save()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1800.0,  'currency_id': self.company_data['currency'].id,    'balance': 1800.0},
            {'flag': 'manual',          'amount_currency': -4200.0, 'currency_id': self.currency_data_2['currency'].id, 'balance': -1200.0},
            {'flag': 'auto_balance',    'amount_currency': -2100.0, 'currency_id': self.currency_data_2['currency'].id, 'balance': -600.0},
        ])

        # Custom currency_id.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'manual')
        wizard._action_mount_line_in_edit(line.index)
        form = WizardForm(wizard)
        form.form_currency_id = self.currency_data['currency']
        wizard = form.save()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1800.0,  'currency_id': self.company_data['currency'].id,    'balance': 1800.0},
            {'flag': 'manual',          'amount_currency': -4200.0, 'currency_id': self.currency_data['currency'].id,   'balance': -2100.0},
            {'flag': 'auto_balance',    'amount_currency': 1050.0,  'currency_id': self.currency_data_2['currency'].id, 'balance': 300.0},
        ])

        # Custom balance.
        line = wizard.line_ids.filtered(lambda x: x.flag == 'manual')
        wizard._action_mount_line_in_edit(line.index)
        form = WizardForm(wizard)
        form.form_balance = -1800.0
        wizard = form.save()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'amount_currency': 1800.0,  'currency_id': self.company_data['currency'].id,    'balance': 1800.0},
            {'flag': 'manual',          'amount_currency': -4200.0, 'currency_id': self.currency_data['currency'].id,   'balance': -1800.0},
        ])

    def test_auto_reconcile_cron(self):
        self.env['account.reconcile.model'].search([('company_id', '=', self.company_data['company'].id)]).unlink()

        st_line = self._create_st_line(1234.0, partner_id=self.partner_a.id, date='2017-01-01')
        self._create_invoice_line(1234.0, self.partner_a, 'out_invoice', inv_date='2017-01-01')

        rule = self.env['account.reconcile.model'].create({
            'name': "test_auto_reconcile_cron",
            'rule_type': 'writeoff_suggestion',
            'auto_reconcile': False,
            'line_ids': [Command.create({'account_id': self.company_data['default_account_revenue'].id})],
        })

        # The CRON is not doing anything since the model is not auto reconcile.
        with freeze_time('2017-01-01'):
            self.env['account.bank.statement.line']._cron_try_auto_reconcile_statement_lines()
        self.assertRecordValues(st_line, [{'is_reconciled': False, 'cron_last_check': False}])

        rule.auto_reconcile = True

        # The CRON don't consider old statement lines.
        with freeze_time('2017-06-01'):
            self.env['account.bank.statement.line']._cron_try_auto_reconcile_statement_lines()
        self.assertRecordValues(st_line, [{'is_reconciled': False, 'cron_last_check': False}])

        # The CRON will auto-reconcile the line.
        with freeze_time('2017-01-02'):
            self.env['account.bank.statement.line']._cron_try_auto_reconcile_statement_lines()
        self.assertRecordValues(st_line, [{'is_reconciled': True, 'cron_last_check': fields.Datetime.from_string('2017-01-02 00:00:00')}])

        st_line1 = self._create_st_line(1234.0, partner_id=self.partner_a.id, date='2018-01-01')
        self._create_invoice_line(1234.0, self.partner_a, 'out_invoice', inv_date='2018-01-01')
        st_line2 = self._create_st_line(1234.0, partner_id=self.partner_a.id, date='2018-01-01')
        self._create_invoice_line(1234.0, self.partner_a, 'out_invoice', inv_date='2018-01-01')

        # Simulate the cron already tried to process 'st_line1' before.
        with freeze_time('2017-12-31'):
            st_line1.cron_last_check = fields.Datetime.now()

        # The statement line with no 'cron_last_check' must be processed before others.
        with freeze_time('2018-01-02'):
            self.env['account.bank.statement.line']._cron_try_auto_reconcile_statement_lines(batch_size=1)

        self.assertRecordValues(st_line1 + st_line2, [
            {'is_reconciled': False, 'cron_last_check': fields.Datetime.from_string('2017-12-31 00:00:00')},
            {'is_reconciled': True, 'cron_last_check': fields.Datetime.from_string('2018-01-02 00:00:00')},
        ])

        with freeze_time('2018-01-03'):
            self.env['account.bank.statement.line']._cron_try_auto_reconcile_statement_lines(batch_size=1)

        self.assertRecordValues(st_line1, [{'is_reconciled': True, 'cron_last_check': fields.Datetime.from_string('2018-01-03 00:00:00')}])

    def test_duplicate_amls_constraint(self):
        st_line = self._create_st_line(1000.0)
        inv_line = self._create_invoice_line(1000.0, self.partner_a, 'out_invoice')

        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        wizard._action_add_new_amls(inv_line)
        wizard._action_add_new_amls(inv_line)

        # Trigger the compute
        with self.assertRaises(UserError), self.cr.savepoint():
            wizard.lines_widget

    @freeze_time('2017-01-01')
    def test_reconcile_model_with_payment_tolerance(self):
        self.env['account.reconcile.model'].search([('company_id', '=', self.company_data['company'].id)]).unlink()

        invoice_line = self._create_invoice_line(1000.0, self.partner_a, 'out_invoice', inv_date='2017-01-01')
        st_line = self._create_st_line(998.0, partner_id=self.partner_a.id, date='2017-01-01', payment_ref=invoice_line.move_id.name)

        rule = self.env['account.reconcile.model'].create({
            'name': "test_reconcile_model_with_payment_tolerance",
            'rule_type': 'invoice_matching',
            'allow_payment_tolerance': True,
            'payment_tolerance_type': 'percentage',
            'payment_tolerance_param': 2.0,
            'line_ids': [Command.create({'account_id': self.company_data['default_account_revenue'].id})],
        })

        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        form = WizardForm(wizard)
        form.todo_command = 'trigger_matching_rules'
        wizard = form.save()
        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 998.0,   'reconcile_model_id': False},
            {'flag': 'new_aml',         'balance': -1000.0, 'reconcile_model_id': rule.id},
            {'flag': 'manual',          'balance': 2.0,     'reconcile_model_id': rule.id},
        ])
