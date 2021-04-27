# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.tests.common import TransactionCase
import base64
from odoo import _
from unittest.mock import patch
from odoo.addons.sign.models.sign_log import SignLog


@patch.object(SignLog, "_create_log")
class TestSignRequest(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        pdf_string = b"%PDF-1.4 DUMMY CONTENT %%EOF"
        pdf_content = base64.b64encode(pdf_string)

        cls.attachment = cls.env['ir.attachment'].create({
            'type': 'binary',
            'datas': pdf_content,
            'name': 'test_employee_contract.pdf',
        })
        cls.template = cls.env['sign.template'].create({
            'attachment_id': cls.attachment.id,
            'sign_item_ids': [(6, 0, [])],
        })
        cls.env['sign.item'].create([
            {
                'type_id': cls.env.ref('sign.sign_item_type_text').id,
                'name': 'employee_id.name',
                'required': True,
                'responsible_id': cls.env.ref('sign.sign_item_role_employee').id,
                'page': 1,
                'posX': 0.273,
                'posY': 0.158,
                'template_id': cls.template.id,
                'width': 0.150,
                'height': 0.015,
            },
        ])
        cls.company_id = cls.env['res.company'].create({
            'name': 'My Belgian Company - TEST',
            'country_id': cls.env.ref('base.be').id,
        })

    def test_sign_request_item_auto_resend(self, _create_log):
        # create a customer with an email address (a@example.com)
        partner_id = self.env['res.partner'].create({
            'name': 'Laurie Poiret',
            'street': '58 rue des Wallons',
            'city': 'Louvain-la-Neuve',
            'zip': '1348',
            'country_id': self.env.ref("base.be").id,
            'phone': '+0032476543210',
            'email': 'laurie.poiret.a@example.com',
            'company_id': self.company_id.id,
        })
        # send the sign document to the Customer
        data = {
            'template_id': self.template.id,
            'signer_id': False,
            'filename': self.template.display_name,
            'subject': _("Signature Request - %s") % (self.template.attachment_id.name or ''),
        }
        roles = self.template.mapped('sign_item_ids.responsible_id')
        signer_ids = [(0, 0, {
            'role_id': role.id,
            'partner_id': partner_id.id,
        }) for role in roles]
        data['signer_ids'] = [(5, 0, 0)] + signer_ids
        data['signers_count'] = len(roles)
        sign_send_request = self.env['sign.send.request'].create(data)

        # create sign send request
        sign_request_id = sign_send_request.create_request()['id']
        sign_request = self.env['sign.request'].browse(sign_request_id)
        request_item_ids = sign_request.request_item_ids
        request_item = request_item_ids[0]
        token_a = request_item.access_token
        self.assertEqual(request_item.signer_email, "laurie.poiret.a@example.com", 'email address should be laurie.poiret.a@example.com')
        self.assertEqual(request_item.is_mail_sent, True, 'email should be sent')
        # resends the document
        request_item.resend_sign_access()
        self.assertEqual(request_item.access_token, token_a, "sign request item's access token should not be changed")
        # change the email address of the signer (laurie.poiret.b@example.com)
        partner_id.write({'email': 'laurie.poiret.b@example.com'})
        token_b = request_item.access_token
        self.assertEqual(request_item.signer_email, "laurie.poiret.b@example.com", 'email address should be laurie.poiret.b@example.com')
        self.assertNotEqual(token_b, token_a, "sign request item's access token should be changed")
        # sign the document
        request_item.write({'state': 'completed'})
        self.assertEqual(request_item.signer_email, "laurie.poiret.b@example.com", 'email address should be laurie.poiret.b@example.com')
        # change the email address of the signer (laurie.poiret.c@example.com)
        partner_id.write({'email': 'laurie.poiret.c@example.com'})
        token_c = request_item.access_token
        self.assertEqual(request_item.signer_email, "laurie.poiret.b@example.com", 'email address should be laurie.poiret.b@example.com')
        self.assertEqual(token_c, token_b, "sign request item's access token should be not changed after the document is signed by the signer")
