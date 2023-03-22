# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import api, fields, models


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    # used to control the renewal flow based on the transaction state
    renewal_state = fields.Selection([('draft', 'Draft'),
                                      ('pending', 'Pending'),
                                      ('authorized', 'Authorized'),
                                      ('cancel', 'Refused')], compute='_compute_renewal_state')
    subscription_action = fields.Selection([
        ('automatic_send_mail', 'Send Mail (automatic payment)'),
        ('manual_send_mail', 'Send Mail (manual payment)'),
        ('assign_token', 'Assign Token'),
    ])

    @api.depends('state')
    def _compute_renewal_state(self):
        for tx in self:
            if tx.state in ['draft', 'pending']:
                renewal_state = tx.state
            elif tx.state in ('done', 'authorized'):
                renewal_state = 'authorized'
            else:
                # tx state in cancel or error
                renewal_state = 'cancel'
            tx.renewal_state = renewal_state

    ####################
    # Business Methods #
    ####################

    def _create_or_link_to_invoice(self):
        tx_to_invoice = self.env['payment.transaction']
        for tx in self:
            if len(tx.sale_order_ids) > 1 or tx.invoice_ids or not tx.sale_order_ids.is_subscription:
                continue
            tx_to_invoice += tx
            draft_invoices = tx.sale_order_ids.order_line.invoice_lines.move_id.filtered(lambda am: am.state == 'draft')
            if draft_invoices:
                draft_invoices.state = 'cancel'

        tx_to_invoice._invoice_sale_orders()
        tx_to_invoice.invoice_ids._post()
        tx_to_invoice.filtered(lambda t: not t.subscription_action).invoice_ids.transaction_ids._send_invoice()

    def _reconcile_after_done(self):
        # override to force invoice creation if the transaction is done for a subscription
        # We don't take care of the sale.automatic_invoice parameter in that case.
        res = super()._reconcile_after_done()
        self._create_or_link_to_invoice()
        self._post_subscription_action()
        return res

    def _get_invoiced_subscription_transaction(self):
        # create the invoices for the transactions that are not yet linked to invoice
        # `_do_payment` do link an invoice to the payment transaction
        # calling `super()._invoice_sale_orders()` would create a second invoice for the next period
        # instead of the current period and would reconcile the payment with the new invoice
        def _filter_invoiced_subscription(self):
            self.ensure_one()
            # we look for tx with one invoice
            if len(self.invoice_ids) != 1:
                return False
            return any(self.invoice_ids.mapped('invoice_line_ids.sale_line_ids.order_id.is_subscription'))

        return self.filtered(_filter_invoiced_subscription)

    def _get_partial_payment_subscription_transaction(self):
        # filter transaction which are only a partial payment of subscription
        tx_with_partial_payments = self.env["payment.transaction"]
        for tx in self:
            for order in tx.sale_order_ids.filtered(lambda so: so.state == 'sale' and so.is_subscription):
                if order.currency_id.compare_amounts(tx.amount, order.amount_total) != 0:
                    tx_with_partial_payments |= tx
        return tx_with_partial_payments

    def _invoice_sale_orders(self):
        """ Override of payment to increase next_invoice_date when needed. """
        transaction_to_invoice = self - self._get_invoiced_subscription_transaction()
        transaction_to_invoice -= self._get_partial_payment_subscription_transaction()
        # Update the next_invoice_date of SOL when the payment_mode is 'success_payment'
        # We have to do it here because when a client confirms and pay a SO from the portal with success_payment
        # The next_invoice_date won't be update by the reconcile_pending_transaction callback (do_payment is not called)
        # Create invoice
        res = super(PaymentTransaction, transaction_to_invoice)._invoice_sale_orders()
        return res

    def _post_subscription_action(self):
        """
        Execute the subscription action once the transaction is in an acceptable state
        This will also reopen the order and remove the payment pending state.
        Partial payment should not have a subscription_action defined and therefore should not reopen the order.
        """
        for tx in self:
            orders = tx.sale_order_ids
            # quotation subscription paid on portal have pending transactions
            orders.pending_transaction = False
            if not tx.subscription_action or not tx.renewal_state == 'authorized':
                # We don't assign failing tokens, and we don't send emails
                continue
            orders = tx.sale_order_ids
            orders.set_open()
            # A mail is always sent for assigned token flow
            if tx.subscription_action == 'assign_token':
                orders._assign_token(tx)
            orders._send_success_mail(tx.invoice_ids, tx)
            if tx.subscription_action in ['manual_send_mail', 'automatic_send_mail']:
                automatic = tx.subscription_action == 'automatic_send_mail'
                for order in orders:
                    order._subscription_post_success_payment(tx, tx.invoice_ids, automatic=automatic)
