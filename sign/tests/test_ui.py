# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from .sign_request_common import SignRequestCommon
import odoo.tests


@odoo.tests.tagged('-at_install', 'post_install')
class TestUi(odoo.tests.HttpCase, SignRequestCommon):
    def test_ui(self):
        self.start_tour("/web", 'sign_widgets_tour', login='admin')

        self.start_tour("/web", 'shared_sign_request_tour', login='admin')
        shared_sign_request = self.env['sign.request'].search([('reference', '=', 'template_1_role-Shared'), ('state', '=', 'shared')])
        self.assertTrue(shared_sign_request.exists(), 'A shared sign request should be created')
        signed_sign_request = self.env['sign.request'].search([('reference', '=', 'template_1_role'), ('state', '=', 'signed')])
        self.assertTrue(signed_sign_request.exists(), 'A signed sign request should be created')
        self.assertEqual(signed_sign_request.create_uid, self.env.ref('base.user_admin'), 'The signed sign request should be created by the admin')
        signer = self.env['res.partner'].search([('email', '=', 'mitchell.admin@public.com')])
        self.assertTrue(signer.exists(), 'A partner should exists with the email provided while signing')
