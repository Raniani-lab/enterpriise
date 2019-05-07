# -*- coding: utf-8 -*-
from odoo.tests import SavepointCase


class TestSubscriptionCommon(SavepointCase):

    @classmethod
    def setUpClass(cls):
        super(TestSubscriptionCommon, cls).setUpClass()
        Analytic = cls.env['account.analytic.account']
        Subscription = cls.env['sale.subscription']
        SubTemplate = cls.env['sale.subscription.template']
        SaleOrder = cls.env['sale.order']
        Tax = cls.env['account.tax']
        Product = cls.env['product.product']
        ProductTmpl = cls.env['product.template']

        # Test Subscription Template
        cls.subscription_tmpl = SubTemplate.create({
            'name': 'TestSubscriptionTemplate',
            'description': 'Test Subscription Template 1',
        })
        cls.subscription_tmpl_2 = SubTemplate.create({
            'name': 'TestSubscriptionTemplate2',
            'description': 'Test Subscription Template 2',
        })
        cls.subscription_tmpl_3 = SubTemplate.create({
            'name': 'TestSubscriptionTemplate3',
            'description': 'Test Subscription Template 3',
            'recurring_rule_boundary':'limited'
        })

        # Test taxes
        cls.percent_tax = Tax.create({
            'name': "Percent tax",
            'amount_type': 'percent',
            'amount': 10,
        })

        # Test products
        cls.product_tmpl = ProductTmpl.create({
            'name': 'TestProduct',
            'type': 'service',
            'recurring_invoice': True,
            'subscription_template_id': cls.subscription_tmpl.id,
            'uom_id': cls.env.ref('uom.product_uom_unit').id,
        })
        cls.product = Product.create({
            'product_tmpl_id': cls.product_tmpl.id,
            'price': 50.0,
            'taxes_id': [(6, 0, [cls.percent_tax.id])],
        })

        cls.product_tmpl_2 = ProductTmpl.create({
            'name': 'TestProduct2',
            'type': 'service',
            'recurring_invoice': True,
            'subscription_template_id': cls.subscription_tmpl_2.id,
            'uom_id': cls.env.ref('uom.product_uom_unit').id,
        })
        cls.product2 = Product.create({
            'product_tmpl_id': cls.product_tmpl_2.id,
            'price': 20.0,
            'taxes_id': [(6, 0, [cls.percent_tax.id])],
        })

        cls.product_tmpl_3 = ProductTmpl.create({
            'name': 'TestProduct3',
            'type': 'service',
            'recurring_invoice': True,
            'subscription_template_id': cls.subscription_tmpl_2.id,
            'uom_id': cls.env.ref('uom.product_uom_unit').id,
        })
        cls.product3 = Product.create({
            'product_tmpl_id': cls.product_tmpl_3.id,
            'price': 15.0,
            'taxes_id': [(6, 0, [cls.percent_tax.id])],
        })

        cls.product_tmpl_4 = ProductTmpl.create({
            'name': 'TestProduct4',
            'type': 'service',
            'recurring_invoice': True,
            'subscription_template_id': cls.subscription_tmpl_3.id,
            'uom_id': cls.env.ref('uom.product_uom_unit').id,
        })
        cls.product4 = Product.create({
            'product_tmpl_id': cls.product_tmpl_4.id,
            'price': 15.0,
            'taxes_id': [(6, 0, [cls.percent_tax.id])],
        })

        # Test user
        TestUsersEnv = cls.env['res.users'].with_context({'no_reset_password': True})
        group_portal_id = cls.env.ref('base.group_portal').id
        cls.user_portal = TestUsersEnv.create({
            'name': 'Beatrice Portal',
            'login': 'Beatrice',
            'email': 'beatrice.employee@example.com',
            'groups_id': [(6, 0, [group_portal_id])]
        })

        # Test analytic account
        cls.account_1 = Analytic.create({
            'partner_id': cls.user_portal.partner_id.id,
            'name': 'Test Account 1',
        })
        cls.account_2 = Analytic.create({
            'partner_id': cls.user_portal.partner_id.id,
            'name': 'Test Account 2',
        })

        # Test Subscription
        cls.subscription = Subscription.create({
            'name': 'TestSubscription',
            'partner_id': cls.user_portal.partner_id.id,
            'pricelist_id': cls.env.ref('product.list0').id,
            'template_id': cls.subscription_tmpl.id,
        })
        cls.sale_order = SaleOrder.create({
            'name': 'TestSO',
            'partner_id': cls.user_portal.partner_id.id,
            'partner_invoice_id': cls.user_portal.partner_id.id,
            'partner_shipping_id': cls.user_portal.partner_id.id,
            'order_line': [(0, 0, {'name': cls.product.name, 'product_id': cls.product.id, 'subscription_id': cls.subscription.id, 'product_uom_qty': 2, 'product_uom': cls.product.uom_id.id, 'price_unit': cls.product.list_price})],
            'pricelist_id': cls.env.ref('product.list0').id,
        })
        cls.sale_order_2 = SaleOrder.create({
            'name': 'TestSO2',
            'partner_id': cls.user_portal.partner_id.id,
            'order_line': [(0, 0, {'name': cls.product.name, 'product_id': cls.product.id, 'product_uom_qty': 1.0, 'product_uom': cls.product.uom_id.id, 'price_unit': cls.product.list_price})]
        })
        cls.sale_order_3 = SaleOrder.create({
            'name': 'TestSO3',
            'partner_id': cls.user_portal.partner_id.id,
            'order_line': [(0, 0, {'name': cls.product.name, 'product_id': cls.product.id, 'product_uom_qty': 1.0, 'product_uom': cls.product.uom_id.id, 'price_unit': cls.product.list_price, }), (0, 0, {'name': cls.product2.name, 'product_id': cls.product2.id, 'product_uom_qty': 1.0, 'product_uom': cls.product2.uom_id.id, 'price_unit': cls.product2.list_price})],
        })
        cls.sale_order_4 = SaleOrder.create({
            'name': 'TestSO4',
            'partner_id': cls.user_portal.partner_id.id,
            'order_line': [(0, 0, {'name': cls.product2.name, 'product_id': cls.product2.id, 'product_uom_qty': 1.0, 'product_uom': cls.product2.uom_id.id, 'price_unit': cls.product2.list_price}), (0, 0, {'name': cls.product3.name, 'product_id': cls.product3.id, 'product_uom_qty': 1.0, 'product_uom': cls.product3.uom_id.id, 'price_unit': cls.product3.list_price})],
        })
        cls.sale_order_5 = SaleOrder.create({
            'name': 'TestSO5',
            'partner_id': cls.user_portal.partner_id.id,
            'order_line': [(0, 0, {'name': cls.product4.name, 'product_id': cls.product4.id, 'product_uom_qty': 1.0, 'product_uom': cls.product4.uom_id.id, 'price_unit': cls.product4.list_price})]
        })
