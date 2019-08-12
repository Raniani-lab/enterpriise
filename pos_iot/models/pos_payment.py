# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models

class PoSPayment(models.Model):
    _inherit = 'pos.payment'

    card_type = fields.Char('Type of card used')
    transaction_id = fields.Char('Payment Transaction ID')
