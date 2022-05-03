# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.exceptions import AccessDenied


class VoipConfigurator(models.Model):
    _name = 'voip.configurator'
    _description = 'VOIP Configurator'

    @api.model
    def get_pbx_config(self):
        if not self.env.user.has_group('base.group_user'):
            raise AccessDenied()
        get_param = self.env['ir.config_parameter'].sudo().get_param
        return {'pbx_ip': get_param('voip.pbx_ip', default='localhost'),
                'wsServer': get_param('voip.wsServer', default='ws://localhost'),
                'voip_username': self.env.user.voip_username,
                'voip_secret': self.env.user.voip_secret,
                'debug': self.user_has_groups('base.group_no_one'),
                'external_device_number': self.env.user.external_device_number,
                'should_call_from_another_device': self.env.user.should_call_from_another_device,
                'should_auto_reject_incoming_calls': self.env.user.should_auto_reject_incoming_calls,
                'how_to_call_on_mobile': self.env.user.how_to_call_on_mobile,
                'mode': get_param('voip.mode', default="demo"),
                }
