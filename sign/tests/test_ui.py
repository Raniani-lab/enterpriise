# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from .sign_request_common import SignRequestCommon
import odoo.tests

from odoo.tools.misc import mute_logger
from odoo.tools.translate import WEB_TRANSLATION_COMMENT


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

    def test_translate_sign_instructions(self):
        new_lang = self.env['res.lang'].create({
            'name': 'Parseltongue',
            'code': 'pa_GB',
            'iso_code': 'pa_GB',
            'url_code': 'pa_GB',
        })
        with mute_logger('odoo.addons.base.models.ir_translation'):
            self.env["base.language.install"].create({'lang_ids': [new_lang.id]}).lang_install()
        self.env['ir.translation'].create({
            'type': 'code',
            'name': 'addons/sign/static/src/js/sign_common.js',
            'lang': 'pa_GB',
            'module': 'sign',
            'src': "Click to start",
            'value': "Click to ssssssstart",
            'state': 'translated',
            'comments': WEB_TRANSLATION_COMMENT,
        })

        # Once `website` is installed, the available langs are only the ones
        # from the website, which by default is just the `en_US` lang.
        langs = self.env['res.lang'].with_context(active_test=False).search([]).get_sorted()
        self.patch(self.registry['res.lang'], 'get_available', lambda self: langs)

        sign_request = self.create_sign_request_1_role(customer=self.partner_1, cc_partners=self.env['res.partner'])
        url = f"/pa_GB/sign/document/{sign_request.id}/{sign_request.request_item_ids.access_token}"
        self.start_tour(url, 'translate_sign_instructions', login=None)
