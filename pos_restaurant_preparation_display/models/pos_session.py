# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api
from odoo.tools import convert

class PosSession(models.Model):
    _inherit = 'pos.session'

    @api.model
    def load_onboarding_data(self):
        super().load_onboarding_data()
        convert.convert_file(self.env, 'pos_restaurant_preparation_display', 'data/pos_restaurant_preparation_display_onboarding.xml', None, mode='init', kind='data')
