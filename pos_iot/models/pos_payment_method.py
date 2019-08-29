# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models

class PoSPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    iot_device_id = fields.Many2one('iot.device', string='Payment Terminal Device', domain=[('type', '=', 'payment')])

    def _get_payment_terminal_selection(self):
        selection_list = super(PoSPaymentMethod, self)._get_payment_terminal_selection()
        if self.env['ir.config_parameter'].sudo().get_param('pos_iot.six_payment_terminal'):
            selection_list.append(('six', 'SIX'))
        if self.env['ir.config_parameter'].sudo().get_param('pos_iot.ingenico_payment_terminal'):
            selection_list.append(('ingenico', 'Ingenico'))
        return selection_list

    @api.onchange('use_payment_terminal')
    def _onchange_use_payment_terminal(self):
        super(PoSPaymentMethod, self)._onchange_use_payment_terminal()
        if not self.use_payment_terminal in {'six', 'ingenico'}:
            self.iot_device_id = False
