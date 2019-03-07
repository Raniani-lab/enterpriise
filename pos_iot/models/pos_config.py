# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, _

class PosConfig(models.Model):
    _inherit = 'pos.config'

    iotbox_id = fields.Many2one('iot.box', 'Related Box')
    proxy_ip = fields.Char(string='IP Address', size=45, related='iotbox_id.ip', store=True,
        help='The hostname or ip address of the hardware proxy, Will be autodetected if left empty.')
    iface_payment_terminal = fields.Boolean(string='Payment Terminal')
    iface_print_via_proxy = fields.Boolean(compute="_compute_print_via_proxy")
    iface_printer_id = fields.Many2one('iot.device', domain=[('type', '=', 'printer')])

    @api.depends('iface_printer_id', 'is_posbox')
    def _compute_print_via_proxy(self):
        for config in self:
            config.iface_print_via_proxy = config.is_posbox and config.iface_printer_id.id is not False
