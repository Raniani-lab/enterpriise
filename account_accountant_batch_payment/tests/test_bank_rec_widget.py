# -*- coding: utf-8 -*-
from odoo import Command
from odoo.addons.account_accountant.tests.test_bank_rec_widget_common import TestBankRecWidgetCommon, WizardForm
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestBankRecWidget(TestBankRecWidgetCommon):

    def test_matching_batch_payment(self):
        payment_method = self.env.ref('account_batch_payment.account_payment_method_batch_deposit')
        payment_method_line = self.company_data['default_journal_bank'].inbound_payment_method_line_ids\
            .filtered(lambda l: l.code == 'batch_payment')

        payment = self.env['account.payment'].create({
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'partner_id': self.partner_a.id,
            'payment_method_line_id': payment_method_line.id,
            'amount': 100.0,
        })
        payment.action_post()

        batch = self.env['account.batch.payment'].create({
            'journal_id': self.company_data['default_journal_bank'].id,
            'payment_ids': [Command.set(payment.ids)],
            'payment_method_id': payment_method.id,
        })
        self.assertRecordValues(batch, [{'state': 'draft'}])

        # Validate the batch and print it.
        batch.validate_batch()
        batch.print_batch_payment()
        self.assertRecordValues(batch, [{'state': 'sent'}])

        st_line = self._create_st_line(1000.0, payment_ref=f"turlututu{batch.name}tsointsoin", partner_id=self.partner_a.id)

        # Create a rule matching the batch payment.
        self.env['account.reconcile.model'].search([('company_id', '=', self.company_data['company'].id)]).unlink()
        rule = self._create_reconcile_model()

        # Ensure the rule matched the batch.
        wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
        form = WizardForm(wizard)
        form.todo_command = 'trigger_matching_rules'
        wizard = form.save()

        self.assertRecordValues(wizard.line_ids, [
            # pylint: disable=C0326
            {'flag': 'liquidity',       'balance': 1000.0,  'reconcile_model_id': False},
            {'flag': 'new_aml',         'balance': -100.0,  'reconcile_model_id': rule.id},
            {'flag': 'auto_balance',    'balance': -900.0,  'reconcile_model_id': False},
        ])
        self.assertRecordValues(wizard, [{
            'selected_batch_payment_ids': batch.ids,
            'state': 'valid',
        }])
        wizard.button_validate(async_action=False)

        self.assertRecordValues(batch, [{'state': 'reconciled'}])
