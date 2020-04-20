# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import Form, tagged
from odoo.addons.partner_commission.tests.setup import TestCommissionsSetup


@tagged('commission_subscription')
class TestSaleSubscription(TestCommissionsSetup):
    def test_referrer_commission_plan_changed(self):
        """When the referrer's commission plan changes, its new commission plan should be set on the subscription,
        unless commission_plan_frozen is checked."""
        self.referrer.commission_plan_id = self.gold_plan

        form = Form(self.env['sale.subscription'])
        form.partner_id = self.customer
        form.referrer_id = self.referrer
        form.template_id = self.template_yearly
        sub = form.save()

        # Auto assignation mode.
        self.referrer.commission_plan_id = self.silver_plan
        self.assertEqual(sub.commission_plan_id, self.silver_plan)

        # Fixed mode.
        sub.commission_plan_frozen = True
        self.referrer.commission_plan_id = self.gold_plan
        self.assertEqual(sub.commission_plan_id, self.silver_plan)

    def test_referrer_grade_changed(self):
        """When the referrer's grade changes, its new commission plan should be set on the subscription,
        unless commission_plan_frozen is checked."""
        self.referrer.grade_id = self.gold
        self.referrer._onchange_grade_id()

        form = Form(self.env['sale.subscription'])
        form.partner_id = self.customer
        form.referrer_id = self.referrer
        form.template_id = self.template_yearly
        sub = form.save()

        # Auto assignation mode.
        self.referrer.grade_id = self.silver
        self.referrer._onchange_grade_id()
        self.assertEqual(sub.commission_plan_id, self.silver_plan)

        # Fixed mode.
        sub.commission_plan_frozen = True
        self.referrer.grade_id = self.gold
        self.referrer._onchange_grade_id()
        self.assertEqual(sub.commission_plan_id, self.silver_plan)

    def test_sub_data_forwarded_to_renewal(self):
        """Some data should be forwarded from the subscription to the renewal's sale order."""
        self.referrer.commission_plan_id = self.gold_plan

        form = Form(self.env['sale.order'].with_user(self.salesman).with_context(tracking_disable=True))
        form.partner_id = self.customer
        form.referrer_id = self.referrer

        with form.order_line.new() as line:
            line.name = self.worker.name
            line.product_id = self.worker
            line.product_uom_qty = 1

        so = form.save()
        so.action_confirm()
        sub = so.order_line.mapped('subscription_id')

        res = sub.prepare_renewal_order()
        res_id = res['res_id']
        renewal_so = self.env['sale.order'].browse(res_id)

        self.assertEqual(renewal_so.referrer_id, sub.referrer_id)
        self.assertEqual(renewal_so.commission_plan_id, sub.commission_plan_id)

    def test_compute_commission(self):
        self.referrer.commission_plan_id = self.gold_plan

        form = Form(self.env['sale.order'].with_user(self.salesman).with_context(tracking_disable=True))
        form.partner_id = self.customer
        form.referrer_id = self.referrer

        with form.order_line.new() as line:
            line.name = self.worker.name
            line.product_id = self.worker
            line.product_uom_qty = 2

        so = form.save()
        so.pricelist_id = self.usd_8
        so.action_confirm()
        sub = so.order_line.mapped('subscription_id')

        self.assertEqual(sub.commission, 180)
