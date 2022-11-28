# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from contextlib import contextmanager
from unittest.mock import patch

from odoo.addons.base.models.ir_cron import ir_cron
from odoo.addons.iap.models.iap_account import IapAccount
from odoo.addons.iap.tools import iap_tools
from odoo.addons.partner_autocomplete.models.iap_autocomplete_api import IapAutocompleteEnrichAPI
from odoo.sql_db import Cursor
from odoo.tests import common


class TestExtractMixin(common.TransactionCase):

    @classmethod
    def setUpClass(cls):
        super(TestExtractMixin, cls).setUpClass()

        # Avoid passing on the iap.account's `get` method to avoid the cr.commit breaking the test transaction.
        cls.env['iap.account'].create([
            {
                'service_name': 'partner_autocomplete',
                'company_ids': [(6, 0, cls.env.user.company_id.ids)],
            },
            {
                'service_name': 'invoice_ocr',
                'company_ids': [(6, 0, cls.env.user.company_id.ids)],
            }
        ])

    @contextmanager
    def _mock_iap_extract(self, extract_response, partner_autocomplete_response=None):
        def _trigger(self, *args, **kwargs):
            # A call to _trigger will directly run the cron
            self.method_direct_trigger()

        def _mock_autocomplete(*args, **kwargs):
            return partner_autocomplete_response

        # The module iap is committing the transaction when creating an IAP account, we mock it to avoid that
        with patch.object(iap_tools, 'iap_jsonrpc', side_effect=lambda *args, **kwargs: extract_response),  \
                patch.object(IapAutocompleteEnrichAPI, '_contact_iap', side_effect=_mock_autocomplete), \
                patch.object(IapAccount, 'get_credits', side_effect=lambda *args, **kwargs: 1), \
                patch.object(Cursor, 'commit', side_effect=lambda *args, **kwargs: None), \
                patch.object(ir_cron, '_trigger', side_effect=_trigger, autospec=True):
            yield
