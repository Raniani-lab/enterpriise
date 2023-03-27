# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.addons.mail_enterprise.web_push import generate_web_push_vapid_key
from odoo import models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    def init(self):
        super().init()
        private_key = 'mail_enterprise.web_push_vapid_private_key'
        config_parameter = self.env['ir.config_parameter']
        private_key_value = config_parameter.get_param(private_key)
        if not private_key_value:
            private, public = generate_web_push_vapid_key()
            config_parameter.set_param(private_key, private)
            config_parameter.set_param('mail_enterprise.web_push_vapid_public_key', public)
