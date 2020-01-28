# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api


class SocialStreamFacebook(models.Model):
    _inherit = 'social.stream'

    @api.model
    def refresh_all(self):
        self.env['social.facebook.event'].fetch_facebook_events()
        return super(SocialStreamFacebook, self).refresh_all()
