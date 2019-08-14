# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, models

class PosOrder(models.Model):
    _inherit = 'pos.order'

    def _payment_fields(self, order, ui_paymentline):
        res = super(PosOrder, self)._payment_fields(order, ui_paymentline)
        res['card_type'] = ui_paymentline.get('card_type', False)
        res['transaction_id'] = ui_paymentline.get('transaction_id', False)
        return res
