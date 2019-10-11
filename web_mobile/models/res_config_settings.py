# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    module_ocn_client = fields.Boolean('Push Notifications')
    # We want default=True but because of odoo/addons/base/models/ir_config_parameter.py:L91
    # when we do a change in False it's not saved in the database. So we have inverted the condition
    disable_redirect_firebase_dynamic_link = fields.Boolean(
        "Allows to open mail's links in the native mobile app Android and iOS if possible (e.g. \"View Task\")",
        config_parameter='web_mobile.disable_redirect_firebase_dynamic_link'
    )
