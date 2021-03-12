# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from unittest.mock import patch

from odoo.tests.common import tagged, TransactionCase


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestL10nArEdiNeutralize(TransactionCase):

    @patch('odoo.addons.l10n_ar_edi.models.res_company.ResCompany._compute_l10n_ar_afip_ws_crt_fname')
    def test_l10n_ar_edi_neutralize(self, mock_compute_l10n_ar_afip_ws_crt_fname):
        Company = self.env['res.company']

        # TODO find a cleaner way to patch the constraints methods or use test key/cert
        Company._constraint_methods.remove(Company._l10n_ar_check_afip_private_key.__func__)
        Company._constraint_methods.remove(Company._l10n_ar_check_afip_certificate.__func__)

        ar_company = Company.create({
            'name': 'Test AR Company',
            'l10n_ar_afip_ws_environment': 'production',
            'l10n_ar_afip_ws_crt': 'ZmFrZSBhciBhZmlwIGNlcnQgZm9yIHRlc3RzCg==',
            'l10n_ar_afip_ws_key': 'ZmFrZSBhciBhZmlwIGtleSBmb3IgdGVzdHMK',
            'currency_id': self.ref('base.USD')
        })

        self.env['res.company']._neutralize()
        self.assertEqual(ar_company.l10n_ar_afip_ws_environment, 'testing')
