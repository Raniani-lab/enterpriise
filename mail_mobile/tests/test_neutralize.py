# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestMailMobileNeutralize(TransactionCase):

    def test_mail_mobile_neutralize(self):
        ICP = self.env['ir.config_parameter']
        ICP.create([
            {'key': 'odoo_ocn.endpoint', 'value': 'fake test mail mobile endpoint'},
            {'key': 'odoo_ocn.project_id', 'value': 666},
            {'key': 'ocn.uuid', 'value': 'deadbeef'}
        ])

        self.env['iap.account']._neutralize()
        self.assertEqual(ICP.get_param('odoo_ocn.endpoint'), 'https://iap-services-test.odoo.com')
        self.assertFalse(ICP.get_param('odoo_ocn.project_id'))
        self.assertFalse(ICP.get_param('ocn.uuid'))
