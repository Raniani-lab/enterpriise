# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import tagged, TransactionCase


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestL10nCoEdiNeutralize(TransactionCase):
    def test_l10n_co_edi_neutralize(self):
        company = self.env['res.company'].create({
            'name': 'Test CO Company',
            'l10n_co_edi_test_mode': False,
            'currency_id': self.ref('base.USD')
        })

        self.env['res.company']._neutralize()
        self.assertTrue(company.l10n_co_edi_test_mode)
