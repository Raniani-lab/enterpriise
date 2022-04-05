# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta

from odoo import fields
from odoo.tests import tagged
from odoo.addons.sale.tests.test_sale_product_attribute_value_config import TestSaleProductAttributeValueCommon
from odoo.addons.website.tools import MockRequest


@tagged('post_install', '-at_install', 'product_attribute')
class TestWebsiteSaleRentingProductAttributeValueConfig(TestSaleProductAttributeValueCommon):

    def test_get_combination_info(self):
        current_website = self.env['website'].get_current_website()
        pricelist = current_website.get_current_pricelist()

        self.computer = self.computer.with_context(website_id=current_website.id)
        self.computer.rent_ok = True

        self.env['product.pricing'].create([
            {
                'duration': 1.0,
                'unit': 'hour',
                'price': 3.5,
                'product_template_id': self.computer.id,
            }, {
                'duration': 5.0,
                'unit': 'hour',
                'price': 15.0,
                'product_template_id': self.computer.id,
            },
        ])

        # make sure the pricelist has a 10% discount
        self.env['product.pricelist.item'].create({
            'price_discount': 10,
            'compute_price': 'formula',
            'pricelist_id': pricelist.id,
        })

        discount_rate = 1 # No discount should apply on rental products (functional choice)

        currency_ratio = 2
        pricelist.currency_id = self._setup_currency(currency_ratio)

        # ensure pricelist is set to with_discount
        pricelist.discount_policy = 'with_discount'

        with MockRequest(self.env, website=current_website):
            combination_info = self.computer._get_combination_info()
            self.assertEqual(combination_info['price'], 3.5 * discount_rate * currency_ratio)
            self.assertEqual(combination_info['list_price'], 3.5 * discount_rate * currency_ratio)
            self.assertEqual(combination_info['price_extra'], 222 * currency_ratio)
            self.assertEqual(combination_info['has_discounted_price'], False)
            self.assertEqual(combination_info['current_rental_price'], 3.5 * discount_rate * currency_ratio)
            self.assertEqual(combination_info['current_rental_duration'], 1)

        with MockRequest(self.env, website=current_website):
            combination_info = self.computer.with_context(
                start_date=fields.Datetime.now(),
                end_date=fields.Datetime.now() + relativedelta(hours=5)
            )._get_combination_info()
            self.assertEqual(combination_info['price'], 3.5 * discount_rate * currency_ratio)
            self.assertEqual(combination_info['list_price'], 3.5 * discount_rate * currency_ratio)
            self.assertEqual(combination_info['price_extra'], 222 * currency_ratio)
            self.assertEqual(combination_info['has_discounted_price'], False)
            self.assertEqual(combination_info['current_rental_price'], 15 * discount_rate * currency_ratio)
            self.assertEqual(combination_info['current_rental_duration'], 5)
