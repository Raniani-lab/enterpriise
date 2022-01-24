# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import tagged

from odoo.addons.project.tests.test_project_profitability import TestProjectProfitabilityCommon
from odoo.addons.sale_subscription.tests.common_sale_subscription import TestSubscriptionCommon


@tagged('-at_install', 'post_install')
class TestProjectProfitability(TestSubscriptionCommon, TestProjectProfitabilityCommon):
    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.subscription.analytic_account_id = cls.account_1

        cls.project.write({
            'partner_id': cls.user_portal.partner_id.id,
            'company_id': cls.company_data['company'].id,
            'analytic_account_id': cls.account_1.id,
        })

    def test_project_profitability(self):
        self.assertDictEqual(
            self.project._get_profitability_items(False),
            self.project_profitability_items_empty,
            'No data should be found since the subscription is always in draft.'
        )

        self.subscription.start_subscription()
        self.assertEqual(self.subscription.stage_id.category, 'progress')
        self.assertFalse(self.subscription.recurring_invoice_line_ids)
        self.assertDictEqual(
            self.project._get_profitability_items(False),
            self.project_profitability_items_empty,
            'No data since the subscription contains no subscription lines.'
        )
        self.sale_order.action_confirm()
        self.assertEqual(len(self.subscription.recurring_invoice_line_ids), 1)
        self.assertDictEqual(
            self.project._get_profitability_items(False),
            {
                'revenues': {
                    'data': [{'id': 'subscriptions', 'to_invoice': self.subscription.recurring_total, 'invoiced': 0.0}],
                    'total': {'to_invoice': self.subscription.recurring_total, 'invoiced': 0.0},
                },
                'costs': {
                    'data': [],
                    'total': {'to_bill': 0.0, 'billed': 0.0},
                }
            }
        )
