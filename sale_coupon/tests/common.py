# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from openerp.tests import common


class TestSaleCouponCommon(common.TransactionCase):

    def setUp(self):
        super(TestSaleCouponCommon, self).setUp()

        # create partner for sale order.
        self.steve = self.env['res.partner'].create({
            'name': 'Steve Bucknor',
            'email': 'steve.bucknor@example.com',
        })

        self.empty_order = self.env['sale.order'].create({
            'partner_id': self.steve.id
        })

        self.uom_unit = self.env.ref('product.product_uom_unit')

        #products
        self.product_A = self.env['product.product'].create({
            'name': 'Product A',
            'list_price': 100,
        })

        self.product_B = self.env['product.product'].create({
            'name': 'Product B',
            'list_price': 5,
        })

        # Immediate Program By A + B: get B free
        # No Conditions
        self.immediate_promotion_program = self.env['sale.coupon.program'].create({
            'name': 'Buy A + 1 B, 1 B are free',
            'promo_code_usage': 'no_code_needed',
            'reward_type': 'product',
            'reward_product_id': self.product_B.id,
            'rule_products_domain': "[('id', 'in', [%s])]" % (self.product_A.id),
            'active': True,
        })

        self.code_promotion_program = self.env['sale.coupon.program'].create({
            'name': 'Buy 1 A + Enter code, 1 A is free',
            'promo_code_usage': 'code_needed',
            'reward_type': 'product',
            'reward_product_id': self.product_A.id,
            'rule_products_domain': "[('id', 'in', [%s])]" % (self.product_A.id),
            'active': True,
        })
