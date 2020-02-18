# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # We want default=True but because of odoo/addons/base/models/ir_config_parameter.py:L91
    # when we do a change in False it's not saved in the database. So we have inverted the condition
    disable_redirect_firebase_dynamic_link = fields.Boolean(
        "Disable link redirection to mobile app",
        help="Check this if dynamic mobile-app detection links cause problems "
            "for your installation. This will stop the automatic wrapping of "
            "links inside outbound emails. The links will always open in a "
            "normal browser, even for users who have the Android/iOS app installed.",
        config_parameter='web_mobile.disable_redirect_firebase_dynamic_link'
    )
