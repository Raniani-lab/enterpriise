# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date
from freezegun import freeze_time

from odoo.tests.common import HttpCase, new_test_user, tagged
from odoo import Command
from odoo import http


@tagged("post_install", "-at_install")
class TestSubscriptionController(HttpCase):
    def setUp(self):
        super().setUp()
        context_no_mail = {'no_reset_password': True, 'mail_create_nosubscribe': True, 'mail_create_nolog': True,}
        SaleOrder = self.env['sale.order'].with_context(context_no_mail)
        ProductTmpl = self.env['product.template'].with_context(context_no_mail)

        self.user = new_test_user(self.env, "test_user_1", email="test_user_1@nowhere.com", tz="UTC")
        self.other_user = new_test_user(self.env, "test_user_2", email="test_user_2@nowhere.com", password="P@ssw0rd!", tz="UTC")

        self.partner = self.user.partner_id
        # Test products
        self.pricing_month = self.env['product.pricing'].create({'duration': 1, 'unit': 'month'})
        self.pricing_year = self.env['product.pricing'].create({'duration': 1, 'unit': 'year'})
        self.sub_product_tmpl = ProductTmpl.create({
            'name': 'TestProduct',
            'type': 'service',
            'recurring_invoice': True,
            'uom_id': self.env.ref('uom.product_uom_unit').id,
            'product_pricing_ids': [Command.set((self.pricing_month + self.pricing_year).ids)],
        })
        self.subscription_tmpl = self.env['sale.order.template'].create({
            'name': 'Subscription template without discount',
            'recurring_rule_type': 'year',
            'recurring_rule_boundary': 'limited',
            'recurring_rule_count': 2,
            'note': "This is the template description",
            'auto_close_limit': 5,
            'sale_order_template_line_ids': [Command.create({
                'name': "monthly",
                'product_id': self.sub_product_tmpl.product_variant_ids.id,
                'pricing_id': self.pricing_month.id,
                'product_uom_qty': 1,
                'product_uom_id': self.sub_product_tmpl.uom_id.id
            }),
                Command.create({
                    'name': "yearly",
                    'product_id': self.sub_product_tmpl.product_variant_ids.id,
                    'pricing_id': self.pricing_year.id,
                    'product_uom_qty': 1,
                    'product_uom_id': self.sub_product_tmpl.uom_id.id,
                })
            ]

        })
        # Test Subscription
        self.subscription = SaleOrder.create({
            'name': 'TestSubscription',
            'is_subscription': True,
            'note': "original subscription description",
            'partner_id': self.other_user.partner_id.id,
            'pricelist_id':  self.other_user.property_product_pricelist.id,
            'sale_order_template_id': self.subscription_tmpl.id,
        })
        self.subscription._onchange_sale_order_template_id()
        self.subscription.order_line.start_date = False  # the confirmation will set the start_date
        self.subscription.end_date = False  # reset the end_date too
        self.env.flush_all()

    def test_renewal_identical(self):
        """ Test subscription renewal """
        with freeze_time("2021-11-18"):
            self.subscription.action_confirm()
            self.subscription.set_to_renew()
            self.assertEqual(self.subscription.end_date, date(2023, 11, 17),
                             'The end date of the subscription should be updated according to the template')
            url = "/my/subscription/%s/renew?access_token=%s" % (self.subscription.id, self.subscription.access_token)
            self.env.flush_all()
            res = self.url_open(url, allow_redirects=False)
            self.assertEqual(res.status_code, 303, "Response should redirection")
            self.env.invalidate_all()
            self.assertEqual(self.subscription.end_date, date(2025, 11, 17),
                             'The end date of the subscription should be updated according to the template')

    def test_fix_stock(self):
        product = self.env.ref('product.product_product_12')
        so = self.env['sale.order'].create({'partner_id': self.env.ref('base.res_partner_2').id})

        self.env['sale.order.line'].create({
            'name': product.get_product_multiline_description_sale(),
            'product_id': product.id,
            'product_uom_qty': 1,
            'price_unit': 12.5,
            'order_id': so.id
        })
        so.action_confirm()

    def test_close_contract(self):
        """ Test subscription close """
        with freeze_time("2021-11-18"):
            self.authenticate(None, None)
            self.subscription.sale_order_template_id.user_closable = True
            self.subscription.action_confirm()
            close_reason_id = self.env.ref('sale_subscription.close_reason_1')
            data = {'access_token': self.subscription.access_token, 'csrf_token': http.Request.csrf_token(self),
                    'close_reason_id': close_reason_id.id, 'closing_text': "I am broke"}
            url = "/my/subscription/%s/close" % self.subscription.id
            res = self.url_open(url, allow_redirects=False, data=data)
            self.assertEqual(res.status_code, 303)
            self.env.invalidate_all()
            self.assertEqual(self.subscription.stage_category, 'closed', 'The subscription should be closed.')
            self.assertEqual(self.subscription.end_date, date(2021, 11, 18), 'The end date of the subscription should be updated.')
