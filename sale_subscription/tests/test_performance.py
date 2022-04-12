# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.sale_subscription.tests.common_sale_subscription import TestSubscriptionCommon
from odoo.tests.common import users, warmup, tagged


@tagged('sub_perf', 'post_install', '-at_install')
class TestSubscriptionPerformance(TestSubscriptionCommon):

    @users('__system__')
    @warmup
    def test_recurring_order_creation_perf(self):
      with self.profile():
        ORDER_COUNT = 100
        partners = self.env['res.partner'].create([
            {'name': 'Jean-Luc %s' % (idx), 'email': 'jean-luc-%s@opoo.com' % (idx)} for idx in range(ORDER_COUNT)])

        with self.assertQueryCount(__system__=1440):
            sale_orders = self.env['sale.order'].create([{
                'name': "SO %s" % idx,
                'partner_id': partners[idx].id,
                'pricelist_id': self.company_data['default_pricelist'].id,
                'order_line': [
                    (0, 0, {
                        'name': self.company_data['product_order_cost'].name,
                        'product_id': self.product.id,
                        'pricing_id': self.pricing_month.id,
                        'product_uom_qty': 2,
                        'qty_delivered': 1,
                        'product_uom': self.company_data['product_order_cost'].uom_id.id,
                        'price_unit': self.company_data['product_order_cost'].list_price,
                    }),
                    (0, 0, {
                        'name': self.company_data['product_delivery_cost'].name,
                        'product_id': self.product.id,
                        'pricing_id': self.pricing_year.id,
                        'product_uom_qty': 4,
                        'qty_delivered': 1,
                        'product_uom': self.company_data['product_delivery_cost'].uom_id.id,
                        'price_unit': self.company_data['product_delivery_cost'].list_price,
                    }),
                ],

            } for idx in range(ORDER_COUNT)])

            sale_orders.action_confirm()

        with self.assertQueryCount(__system__=7731):
            sale_orders._create_recurring_invoice()
