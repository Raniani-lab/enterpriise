# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestVoipNeutralize(TransactionCase):

    def test_voip_neutralize(self):
        key = 'voip.mode'
        self.env['ir.config_parameter'].create({
            'key': key,
            'value': 'prod'
        })

        self.env['ir.config_parameter']._neutralize()

        expected_value = 'demo'
        self.assertEqual(self.env['ir.config_parameter'].get_param(key), expected_value)
