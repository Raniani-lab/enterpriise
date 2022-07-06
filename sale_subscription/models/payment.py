# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class PaymentAcquirer(models.Model):

    _inherit = 'payment.acquirer'

    def _is_tokenization_required(self, sale_order_id=None, **kwargs):
        """ Override of payment to return whether confirming the order will create a subscription.

        The order is a subscription tokenization of the payment transaction is required.

        :param int sale_order_id: The sale order to be paid, if any, as a `sale.order` id
        :return: Whether confirming the order will create a subscription
        :rtype: bool
        """
        if sale_order_id:
            sale_order = self.env['sale.order'].browse(sale_order_id).exists()
            if sale_order.payment_mode == 'success_payment' or sale_order.subscription_id.payment_mode == 'success_payment':
                return True
        return super()._is_tokenization_required(sale_order_id=sale_order_id, **kwargs)


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    renewal_allowed = fields.Boolean(
        help="Technical field used to control the renewal flow based on the transaction state",
        compute='_compute_renewal_allowed', store=False)

    @api.depends('state')
    def _compute_renewal_allowed(self):
        for tx in self:
            tx.renewal_allowed = tx.state in ('done', 'authorized')


class PaymentToken(models.Model):
    _name = 'payment.token'
    _inherit = 'payment.token'

    def _handle_deactivation_request(self):
        """ Override of payment to void the token on linked subscriptions.

        Note: self.ensure_one()

        :return: None
        """
        super()._handle_deactivation_request()  # Called first in case an UserError is raised
        linked_subscriptions = self.env['sale.order'].search(
            [('payment_token_id', '=', self.id)]
        )
        linked_subscriptions.payment_token_id = False

    def get_linked_records_info(self):
        """ Override of payment to add information about subscriptions linked to the current token.

        Note: self.ensure_one()

        :return: The list of information about linked subscriptions
        :rtype: list
        """
        res = super().get_linked_records_info()
        subscriptions = self.env['sale.order'].search([('payment_token_id', '=', self.id)])
        for sub in subscriptions:
            res.append({
                'description': subscriptions._description,
                'id': sub.id,
                'name': sub.name,
                'url': sub.get_portal_url()
            })
        return res
