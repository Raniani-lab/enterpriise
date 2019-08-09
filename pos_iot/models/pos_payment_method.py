# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models

class PoSPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    use_payment_terminal = fields.Selection(selection_add=[('iot_box', 'Connected to IOTBox')])
