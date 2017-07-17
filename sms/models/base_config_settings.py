# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.tools.safe_eval import safe_eval


class BaseConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    default_sms_provider_id = fields.Many2one(
        'sms.provider', string='Default SMS Provider',
        help="By default, SMS text messages generated by Odoo will use this provider.")

    @api.model
    def get_values(self):
        res = super(BaseConfigSettings, self).get_values()
        get_param = self.env['ir.config_parameter'].sudo().get_param
        res.update(
            default_sms_provider_id=safe_eval(get_param('default_sms_provider_id', default='False')),
        )
        return res

    def set_values(self):
        super(BaseConfigSettings, self).set_values()
        set_param = self.env['ir.config_parameter'].sudo().set_param
        set_param("default_sms_provider_id", repr(self.default_sms_provider_id.id))

    def action_sms_test(self):
        if not self.default_sms_provider_id:
            raise UserError(_('Please set a default SMS provider.'))
        self.default_sms_provider_id._test_sms()
