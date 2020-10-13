# -*- coding: utf-8 -*-

from odoo.addons.account_taxcloud.models import taxcloud_request

class TaxCloudRequest(taxcloud_request.TaxCloudRequest):

    def set_order_items_detail(self, order):
        self.cart_items = self.factory.ArrayOfCartItem()
        self.cart_items.CartItem = self._process_lines(order.order_line)
