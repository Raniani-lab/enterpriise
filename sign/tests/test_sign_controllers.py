# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from .sign_request_common import SignRequestCommon
from odoo.addons.sign.controllers.main import Sign
from odoo.exceptions import ValidationError
from odoo.addons.website.tools import MockRequest
from odoo.tests import tagged

@tagged('post_install', '-at_install')
class TestSignController(SignRequestCommon):
    def setUp(self):
        super().setUp()
        self.SignController = Sign()

    # test float auto_field display
    def test_sign_controller_float(self):
        sign_request = self.create_sign_request_no_item(signer=self.partner_1, cc_partners=self.partner_4)
        text_type = self.env['sign.item.type'].search([('name', '=', 'Text')])
        # the partner_latitude expects 7 zeros of decimal precision
        text_type.auto_field = 'partner_latitude'
        token_a = self.env["sign.request.item"].search([('sign_request_id', '=', sign_request.id)]).access_token
        with MockRequest(sign_request.env):
            values = self.SignController.get_document_qweb_context(sign_request.id, token=token_a)
            sign_type = list(filter(lambda sign_type: sign_type["name"] == "Text", values["sign_item_types"]))[0]
            latitude = sign_type["auto_field"]
            self.assertEqual(latitude, "0.0000000")

    # test monetary auto_field display
    def test_sign_controller_monetary(self):
        sign_request = self.create_sign_request_no_item(signer=self.partner_1, cc_partners=self.partner_4)
        text_type = self.env['sign.item.type'].search([('name', '=', 'Text')])
        # we set the text type defaut value with the partner.credit
        text_type.auto_field = 'credit'
        monetary_field = self.partner_1._fields['credit']
        monetary_field.currency_field = 'currency_id'
        # we set the partner currency as the euro and change its precison to 5 decimals
        euro_currency = self.env['res.currency'].search([('name', '=', 'EUR')], limit=1)
        self.partner_1.currency_id = euro_currency
        euro_currency.rounding = 0.00001
        token_a = self.env["sign.request.item"].search([('sign_request_id', '=', sign_request.id)]).access_token
        with MockRequest(sign_request.env):
            values = self.SignController.get_document_qweb_context(sign_request.id, token=token_a)
            sign_type = list(filter(lambda sign_type: sign_type["name"] == "Text", values["sign_item_types"]))[0]
            credit = sign_type["auto_field"]
            self.assertEqual(credit, "0.00000")

    # test auto_field with wrong partner field
    def test_sign_controller_dummy_fields(self):
        text_type = self.env['sign.item.type'].search([('name', '=', 'Text')])
        # we set a dummy field that raises an error
        with self.assertRaises(ValidationError):
            text_type.auto_field = 'this_is_not_a_partner_field'
