# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account_avatax.tests.common import TestAccountAvataxCommon
from odoo.addons.account_avatax_sale_subscription.tests.test_sale_subscription import TestSaleSubscriptionAvalaraCommon
from odoo.addons.sale_subscription.tests.common_sale_subscription import TestSubscriptionCommon
from odoo.addons.payment.tests.http_common import PaymentHttpCommon
from odoo.tests.common import tagged


@tagged("post_install", "-at_install")
class TestAvataxSubscriptionController(TestSaleSubscriptionAvalaraCommon, PaymentHttpCommon, TestSubscriptionCommon, TestAccountAvataxCommon):
    def setUp(self):
        super().setUp()
        avatax_fp = self.env.ref('account_avatax.account_fiscal_position_avatax_us')
        avatax_fp.sudo().company_id = self.company
        self.subscription.partner_id = self.user_portal.partner_id
        self.subscription.fiscal_position_id = avatax_fp
        self.subscription._portal_ensure_token()

    def test_01_avatax_called_in_preview(self):
        url = "/my/subscription/%s?access_token=%s" % (self.subscription.id, self.subscription.access_token)
        with self._capture_request({'lines': [], 'summary': []}) as capture:
            self.url_open(url, allow_redirects=False)

        self.assertEqual(
            capture.val and capture.val['json']['createTransactionModel']['referenceCode'],
            self.subscription.name,
            'Should have queried avatax when viewing the subscription.'
        )

    def test_02_avatax_called_in_manual_payment(self):
        with self._capture_request({'lines': [], 'summary': []}):
            self.subscription.action_confirm()

        self.assertEqual(len(self.subscription.invoice_ids), 0, 'There should be no invoices yet.')

        url = self._build_url("/my/subscription/%s/transaction/" % self.subscription.id)
        data = {
            'access_token': self.subscription.access_token,
            'landing_route': self.subscription.get_portal_url(),
            'provider_id': self.dummy_provider.id,
            'payment_method_id': self.payment_method_id,
            'token_id': False,
            'flow': 'direct',
        }

        with self._capture_request({'lines': [], 'summary': []}) as capture:
            self.make_jsonrpc_request(url, data)

        self.assertEqual(len(self.subscription.invoice_ids), 1, 'One invoice should have been created.')
        self.assertEqual(
            capture.val and capture.val['json']['createTransactionModel']['referenceCode'],
            self.subscription.invoice_ids[0].name,
            'Should have queried avatax on the created invoice when manually initiating a payment.'
        )
