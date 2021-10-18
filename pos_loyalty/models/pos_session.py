# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _pos_ui_models_to_load(self):
        result = super()._pos_ui_models_to_load()
        if self.config_id.loyalty_id:
            result.append('loyalty.program')
        return result

    def _loader_params_loyalty_program(self):
        return {'search_params': {'domain': [('id', '=', self.config_id.loyalty_id.id)], 'fields': ['name', 'points']}}

    def _get_pos_ui_loyalty_program(self, params):
        program = self.env['loyalty.program'].search_read(**params['search_params'])[0]
        program['rules'] = self._get_pos_ui_loyalty_rule(self._loader_params_loyalty_rule())
        program['rewards'] = self._get_pos_ui_loyalty_reward(self._loader_params_loyalty_reward())
        return program

    def _loader_params_loyalty_rule(self):
        return {
            'search_params': {
                'domain': [('loyalty_program_id', '=', self.config_id.loyalty_id.id)],
                'fields': ['name', 'valid_product_ids', 'points_quantity', 'points_currency', 'loyalty_program_id'],
            },
        }

    def _get_pos_ui_loyalty_rule(self, params):
        return self.env['loyalty.rule'].search_read(**params['search_params'])

    def _loader_params_loyalty_reward(self):
        return {'search_params': {'domain': [('loyalty_program_id', '=', self.config_id.loyalty_id.id)], 'fields': []}}

    def _get_pos_ui_loyalty_reward(self, params):
        return self.env['loyalty.reward'].search_read(**params['search_params'])

    def _loader_params_res_partner(self):
        result = super()._loader_params_res_partner()
        if self.config_id.loyalty_id:
            result['search_params']['fields'].append('loyalty_points')
        return result
