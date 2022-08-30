# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class PaymentAcquirer(models.Model):
    _inherit = 'payment.acquirer'

    custom_mode = fields.Selection(
        selection_add=[('cash_on_delivery', 'Cash On Delivery')]
    )

    @api.model
    def _get_compatible_acquirers(self, *args, sale_order_id=None, **kwargs):
        """ Override of payment to exclude COD acquirers if the delivery doesn't match.

        :param int sale_order_id: The sale order to be paid, if any, as a `sale.order` id
        :return: The compatible acquirers
        :rtype: recordset of `payment.acquirer`
        """
        compatible_acquirers = super()._get_compatible_acquirers(
            *args, sale_order_id=sale_order_id, **kwargs
        )
        sale_order = self.env['sale.order'].browse(sale_order_id).exists()
        if sale_order.carrier_id.delivery_type != 'ups' or not sale_order.carrier_id.ups_cod:
            compatible_acquirers.filtered(
                lambda acq: acq.provider != 'custom' or acq.custom_mode != 'cash_on_delivery'
            )

        return compatible_acquirers
