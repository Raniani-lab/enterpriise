# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, _

class PosConfig(models.Model):
    _inherit = 'pos.config'

    iotbox_id = fields.Many2one('iot.box', 'Related Box', domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]")
    proxy_ip = fields.Char(string='IP Address', size=45, related='iotbox_id.ip', store=True,
        help='The hostname or ip address of the hardware proxy, Will be autodetected if left empty.')
    iface_print_via_proxy = fields.Boolean(compute="_compute_print_via_proxy")
    iface_printer_id = fields.Many2one('iot.device', domain="[('type', '=', 'printer'), '|', ('company_id', '=', False), ('company_id', '=', company_id)]")
    payment_terminal_device_ids = fields.Many2many('iot.device', compute="_compute_payment_terminal_device_ids")

    @api.depends('iface_printer_id', 'is_posbox')
    def _compute_print_via_proxy(self):
        for config in self:
            config.iface_print_via_proxy = config.is_posbox and config.iface_printer_id.id is not False

    @api.depends('payment_method_ids', 'payment_method_ids.iot_device_id')
    def _compute_payment_terminal_device_ids(self):
        for config in self:
            config.payment_terminal_device_ids = config.payment_method_ids.mapped('iot_device_id')
