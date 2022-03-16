# -*- coding: utf-8 -*-
import datetime
from dateutil.relativedelta import relativedelta
from unittest.mock import patch
from freezegun import freeze_time


from odoo import fields, Command
from odoo.exceptions import AccessError

from odoo.addons.payment.tests.common import PaymentCommon
from odoo.addons.sale_subscription.controllers.portal import PaymentPortal
from odoo.addons.sale_subscription.tests.common_sale_subscription import TestSubscriptionCommon
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestSubscriptionPayments(PaymentCommon, TestSubscriptionCommon):

    # Mocking for 'test_auto_payment_with_token'
    # Necessary to have a valid and done transaction when the cron on subscription passes through
    def _mock_subscription_do_payment(self, payment_method, invoice):
        tx_obj = self.env['payment.transaction']
        reference = "CONTRACT-%s-%s" % (self.id, datetime.datetime.now().strftime('%y%m%d_%H%M%S%f'))
        values = {
            'amount': invoice.amount_total,
            'acquirer_id': self.acquirer.id,
            'operation': 'offline',
            'currency_id': invoice.currency_id.id,
            'reference': reference,
            'token_id': payment_method.id,
            'partner_id': invoice.partner_id.id,
            'partner_country_id': invoice.partner_id.country_id.id,
            'invoice_ids': [(6, 0, [invoice.id])],
            'state': 'done',
        }
        tx = tx_obj.create(values)
        return tx

    # Mocking for 'test_auto_payment_with_token'
    # Otherwise the whole sending mail process will be triggered
    # And we are not here to test that flow, and it is a heavy one
    def _mock_subscription_send_success_mail(self, tx, invoice):
        self.mock_send_success_count += 1
        return 666

    # Mocking for 'test_auto_payment_with_token'
    # Avoid account_id is False when creating the invoice
    def _mock_prepare_invoice_data(self):
        invoice = self.original_prepare_invoice()
        invoice['partner_bank_id'] = False
        return invoice

    def test_auto_payment_with_token(self):

        self.original_prepare_invoice = self.subscription._prepare_invoice

        patchers = [
            patch('odoo.addons.sale_subscription.models.sale_order.SaleOrder._do_payment', wraps=self._mock_subscription_do_payment),
            patch('odoo.addons.sale_subscription.models.sale_order.SaleOrder.send_success_mail', wraps=self._mock_subscription_send_success_mail),
        ]

        for patcher in patchers:
            patcher.start()

        self.subscription_tmpl.payment_mode = 'success_payment'

        self.subscription.write({
            'partner_id': self.partner.id,
            'company_id': self.company.id,
            'payment_token_id': self.payment_method.id,
            'sale_order_template_id': self.subscription_tmpl.id,
        })
        self.subscription._onchange_sale_order_template_id()
        self.subscription.action_confirm()
        self.subscription.order_line.write({'next_invoice_date': fields.Date.today()})
        self.mock_send_success_count = 0
        self.env['sale.order']._cron_recurring_create_invoice()
        self.assertEqual(self.mock_send_success_count, 1, 'a mail to the invoice recipient should have been sent')
        self.assertEqual(self.subscription.stage_category, 'progress', 'subscription with online payment and a payment method set should stay opened when transaction succeeds')
        invoice = self.subscription.invoice_ids.sorted('date')[-1]
        recurring_total_with_taxes = self.subscription.amount_total
        self.assertEqual(invoice.amount_total, recurring_total_with_taxes,
                         'website_subscription: the total of the recurring invoice created should be the subscription '
                         'recurring total + the products taxes')
        self.assertTrue(all(line.tax_ids.ids == self.tax_10.ids for line in invoice.invoice_line_ids),
                        'website_subscription: All lines of the recurring invoice created should have the percent tax '
                        'set on the subscription products')
        self.assertTrue(
            all(tax_line.tax_line_id == self.tax_10 for tax_line in invoice.line_ids.filtered('tax_line_id')),
            'The invoice tax lines should be set and should all use the tax set on the subscription products')

        self.mock_send_success_count = 0
        start_date = fields.Datetime.now() - relativedelta(months=1)
        recurring_next_date = fields.Datetime.now() - relativedelta(days=1)
        self.subscription.payment_token_id = False
        failing_subs = self.env['sale.order']
        subscription_mail_fail = self.subscription.copy({'to_renew': True, 'date_order': start_date,
                                                         'next_invoice_date': recurring_next_date,
                                                         'stage_id': self.subscription.stage_id.id,
                                                         'payment_token_id': None})

        failing_subs |= subscription_mail_fail
        for dummy in range(5):
            failing_subs |= subscription_mail_fail.copy({'to_renew': True, 'stage_id': self.subscription.stage_id.id})
        # issue: two problems:
        # 1) payment failed, we want to avoid trigger it twice: (double cost) --> payment_exception
        # 2) batch: we need to avoid taking subscription two time. flag remains until the end of the last trigger
        failing_subs.order_line.qty_to_invoice = 1
        self.env['sale.order']._create_recurring_invoice(automatic=True, batch_size=3)
        self.assertFalse(self.mock_send_success_count)
        failing_result = [not res for res in failing_subs.mapped('payment_exception')]
        self.assertTrue(all(failing_result), "The subscription are not flagged anymore")
        invoice_batch_tag = self.env.ref('sale_subscription.invoice_batch')
        failing_result = [invoice_batch_tag.id not in res.ids for res in failing_subs.mapped('account_tag_ids')]
        self.assertTrue(all(failing_result), "The subscription are not flagged anymore")
        failing_subs.payment_token_id = self.payment_method.id
        # Trigger the invoicing manually after fixing it
        failing_subs._create_recurring_invoice()
        vals = [sub.payment_exception for sub in failing_subs if sub.payment_exception]
        self.assertFalse(vals, "The subscriptions are not flagged anymore, the payment succeeded")

        for patcher in patchers:
            patcher.stop()

    def test_auto_payment_different_periodicity(self):
        # Test that a subscription with lines of different periodicity (monthly mixed with yearly)
        # have the expected behavior

        self.original_prepare_invoice = self.subscription._prepare_invoice

        patchers = [
            patch('odoo.addons.sale_subscription.models.sale_order.SaleOrder._do_payment', wraps=self._mock_subscription_do_payment),
            patch('odoo.addons.sale_subscription.models.sale_order.SaleOrder.send_success_mail', wraps=self._mock_subscription_send_success_mail),
        ]

        for patcher in patchers:
            patcher.start()

        subscription_tmpl = self.env['sale.order.template'].create({
            'name': 'Subscription template without discount',
            'recurring_rule_boundary': 'limited',
            'note': "This is the template description",
            'payment_mode': 'success_payment', 'recurring_rule_count': 13,
            'recurring_rule_type': 'month',
            'auto_close_limit': 5,
        })

        self.subscription.write({
            'partner_id': self.partner.id,
            'company_id': self.company.id,
            'payment_token_id': self.payment_method.id,
            'sale_order_template_id': subscription_tmpl.id,
        })
        self.mock_send_success_count = 0
        with freeze_time("2021-01-03"):
            self.subscription.order_line = [Command.clear()]
            self.subscription.write({
                'order_line': [Command.create({'product_id': self.product.id,
                                               'name': "month",
                                               'price_unit': 42,
                                               'product_uom_qty': 2,
                                               'pricing_id': self.pricing_month.id,
                                               }),
                               Command.create({'product_id': self.product.id,
                                               'name': "year",
                                               'price_unit': 420,
                                               'product_uom_qty': 3,
                                               'pricing_id': self.pricing_year.id,
                                               }),
                               ]}
            )
            self.subscription.action_confirm()
            self.assertEqual(self.subscription.end_date, datetime.date(2022, 2, 2))
            self.env['sale.order']._cron_recurring_create_invoice()
            invoice = self.subscription.invoice_ids.sorted('date')[-1]
            # Two products are invoiced the first time
            self.assertEqual(len(invoice.invoice_line_ids), 2, 'Two products are invoiced the first time')
            lines = self.subscription.order_line.sorted('id')
            next_invoices = lines.mapped('next_invoice_date')
            self.assertEqual(next_invoices, [datetime.datetime(2021, 2, 3), datetime.datetime(2022, 1, 3)])
        with freeze_time("2021-02-03"):
            self.subscription.invalidate_cache()
            self.env['sale.order']._cron_recurring_create_invoice()
            invoice = self.subscription.invoice_ids.sorted('date')[-1]
            self.assertEqual(len(invoice.invoice_line_ids), 1, 'Only one product must be invoiced the second time')

        with freeze_time("2021-03-03"):
            self.subscription.invalidate_cache()
            self.env['sale.order']._cron_recurring_create_invoice()
            invoice = self.subscription.invoice_ids.sorted('date')[-1]
            self.assertEqual(len(invoice.invoice_line_ids), 1, 'Only one product must be invoiced the second time')
        # Jum in time, one year later,
        with freeze_time("2022-01-03"):
            # Change the next_invoice_date of the monthly line
            self.subscription.order_line.filtered(lambda l: l.pricing_id.unit == 'month').write({'next_invoice_date': datetime.datetime(2022, 1, 3)})
            self.env['sale.order']._cron_recurring_create_invoice()
            invoice = self.subscription.invoice_ids.sorted('date')[-1]
            self.assertEqual(invoice.date, datetime.date(2022, 1, 3), 'We invoiced today')
            self.assertEqual(len(invoice.invoice_line_ids), 2, 'After one year, both lines are invoiced')

        with freeze_time("2022-02-03"):
            self.env['sale.order']._cron_recurring_create_invoice()
            self.assertEqual(self.subscription.stage_id.category, 'closed', '5 days after the next invoice date is passed, the subscription is automatically closed')
            invoice = self.subscription.invoice_ids.sorted('date')[-1]
            self.assertEqual(invoice.date, datetime.date(2022, 1, 3), 'We should not create a new invoices')

        for patcher in patchers:
            patcher.stop()

    def test_prevents_assigning_not_owned_payment_tokens_to_subscriptions(self):
        malicious_user_subscription = self.env['sale.order'].create({
            'name': 'Free Subscription',
            'partner_id': self.malicious_user.partner_id.id,
            'sale_order_template_id': self.subscription_tmpl.id,
        })
        malicious_user_subscription._onchange_sale_order_template_id()
        self.partner = self.env['res.partner'].create(
            {'name': 'Stevie Nicks',
             'email': 'sti@fleetwood.mac',
             'property_account_receivable_id': self.account_receivable.id,
             'property_account_payable_id': self.account_receivable.id,
             'company_id': self.env.company.id})
        stolen_payment_method = self.env['payment.token'].create(
            {'name': 'Jimmy McNulty',
             'partner_id': self.partner.id,
             'acquirer_id': self.dummy_acquirer.id,
             'acquirer_ref': 'Omar Little'})

        with self.assertRaises(AccessError):
            malicious_user_subscription.with_user(self.malicious_user).write({
                'payment_token_id': stolen_payment_method.id,
                # payment token not related to al capone
            })

    def test_do_payment_calls_send_payment_request_only_once(self):
        self.invoice = self.env['account.move'].create(
            self.subscription._prepare_invoice()
        )
        with patch(
            'odoo.addons.payment.models.payment_transaction.PaymentTransaction'
            '._send_payment_request'
        ) as patched:
            self.subscription._do_payment(self.create_token(), self.invoice)
            patched.assert_called_once()

    def test_compute_show_tokenize_input_on_sale_order_with_subscription(self):
        self.subscription_tmpl.payment_mode = 'success_payment'
        show_tokenize_input = PaymentPortal._compute_show_tokenize_input_mapping(
            self.acquirer, logged_in=True, sale_order_id=self.subscription.id
        )
        self.assertEqual(
            show_tokenize_input, {self.acquirer.id: False},
            "The save payment details checkbox should be hidden if the sale order contains a "
            "subscription product that is not already linked to a subscription."
        )
