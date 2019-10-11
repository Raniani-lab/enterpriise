# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import urllib.parse

from odoo import models

MOBILE_APP_IDENTIFIER = 'com.odoo.mobile'
FIREBASE_DEFAULT_LINK = 'https://redirect-url.email/'
BLACK_LIST_PARAM = {
    'access_token',
    'auth_signup_token',
}

class MailThread(models.AbstractModel):
    _inherit = 'mail.thread'

    def _notify_get_action_link(self, link_type, **kwargs):
        original_link = super(MailThread, self)._notify_get_action_link(link_type, **kwargs)
        # BLACK_LIST_PARAM to avoid leak of token (3rd party: Firebase)
        if link_type is not 'view' or BLACK_LIST_PARAM.intersection(set(kwargs)):
            return original_link

        # Check if feature is enable to avoid request and computation
        disable_redirect_fdl = self.env['ir.config_parameter'].sudo().get_param(
            'web_mobile.disable_redirect_firebase_dynamic_link', default=False)
        if disable_redirect_fdl:
            return original_link

        # Force to have absolute url and not relative url
        # This is already done in the super function _notify_get_action_link
        # but in some case "this" is not defined.
        # The base url is not prepend it's why we do it manually.
        if original_link.startswith('/'):
            base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
            original_link = base_url + original_link

        # https://firebase.google.com/docs/dynamic-links/create-manually
        url_params = urllib.parse.urlencode({
            'link': original_link,
            'apn': MOBILE_APP_IDENTIFIER,
            'afl': original_link,
            'ibi': MOBILE_APP_IDENTIFIER,
            'ifl': original_link,
        })
        return "%s?%s" % (FIREBASE_DEFAULT_LINK, url_params)
