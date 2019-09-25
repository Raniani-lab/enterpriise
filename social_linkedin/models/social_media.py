# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import hmac
import hashlib

from odoo import models, fields, api
from werkzeug.urls import url_encode, url_join


class SocialMediaLinkedin(models.Model):
    _inherit = 'social.media'

    _LINKEDIN_ENDPOINT = 'https://api.linkedin.com/v2/'

    media_type = fields.Selection(selection_add=[('linkedin', 'LinkedIn')])

    def action_add_account(self):
        self.ensure_one()

        if self.media_type != 'linkedin':
            return super(SocialMediaLinkedin, self).action_add_account()

        linkedin_use_own_account = self.env['ir.config_parameter'].sudo().get_param('social.linkedin_use_own_account')
        linkedin_app_id = self.env['ir.config_parameter'].sudo().get_param('social.linkedin_app_id')
        linkedin_client_secret = self.env['ir.config_parameter'].sudo().get_param('social.linkedin_client_secret')

        if linkedin_app_id and linkedin_client_secret and linkedin_use_own_account:
            return self._add_linkedin_accounts_from_configuration(linkedin_app_id)
        else:
            return self._add_linkedin_accounts_from_iap()

    def _add_linkedin_accounts_from_configuration(self, linkedin_app_id):
        params = {
            'response_type': 'code',
            'client_id': linkedin_app_id,
            'redirect_uri': self._get_linkedin_redirect_uri(),
            'state': self._compute_linkedin_csrf(),
            'scope': 'r_liteprofile r_emailaddress w_member_social'
        }

        return {
            'type': 'ir.actions.act_url',
            'url': 'https://www.linkedin.com/oauth/v2/authorization?%s' % url_encode(params),
            'target': 'self'
        }

    def _add_linkedin_accounts_from_iap(self):
        o_redirect_uri = url_join(
            self.env['ir.config_parameter'].sudo().get_param('web.base.url'),
            'social_linkedin/callback')

        social_iap_endpoint = self.env['ir.config_parameter'].sudo().get_param(
            'social.social_iap_endpoint',
            self.env['social.media']._DEFAULT_SOCIAL_IAP_ENDPOINT
        )

        social_iap_endpoint = url_join(social_iap_endpoint,
                                       'iap/social_linkedin/add_accounts')

        params = {
            'state': self._compute_linkedin_csrf(),
            'scope': 'r_liteprofile r_emailaddress w_member_social',
            'o_redirect_uri': o_redirect_uri,
            'db_uuid': self.env['ir.config_parameter'].sudo().get_param('database.uuid')
        }

        return {
            'type': 'ir.actions.act_url',
            'url': social_iap_endpoint + '?' + url_encode(params),
            'target': 'self'
        }

    def _compute_linkedin_csrf(self):
        return hmac.new(
            self.env['ir.config_parameter'].sudo().get_param('database.secret').encode('utf-8'),
            str(self.id).encode('utf-8'), hashlib.sha256).hexdigest()

    def _get_linkedin_redirect_uri(self):
        return url_join(
            self.env['ir.config_parameter'].sudo().get_param('web.base.url'),
            'social_linkedin/callback')
