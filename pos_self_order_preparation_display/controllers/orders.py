# -*- coding: utf-8 -*-

from odoo import http
from odoo.addons.pos_self_order.controllers.orders import PosSelfOrderController

class PosSelfOrderPreparationDisplayController(PosSelfOrderController):
    @http.route()
    def process_new_order(self, order, access_token, table_identifier, device_type):
        res = super().process_new_order(order, access_token, table_identifier, device_type)
        self._send_to_preparation_display(order, access_token, table_identifier, res['id'])
        return res

    @http.route()
    def update_existing_order(self, order, access_token, table_identifier):
        res = super().update_existing_order(order, access_token, table_identifier)
        self._send_to_preparation_display(order, access_token, table_identifier, res['id'])
        return res

    def _send_to_preparation_display(self, order, access_token, table_identifier, order_id):
        pos_config, _ = self._verify_authorization(access_token, table_identifier, order.get('take_away'))
        order_id = pos_config.env['pos.order'].browse(order_id)
        if pos_config.self_ordering_mode == 'kiosk':
            payment_methods = pos_config.payment_method_ids.filtered(lambda p: p.use_payment_terminal == 'adyen')
        else:
            payment_methods = pos_config.self_order_online_payment_method_id
        if pos_config.self_ordering_pay_after == 'each' and len(payment_methods) == 0:
            pos_config.env['pos_preparation_display.order'].process_order(order_id.id)