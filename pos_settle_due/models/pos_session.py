# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _loader_params_res_partner(self):
        result = super()._loader_params_res_partner()
        if self.user_has_groups('account.group_account_readonly'):
            result['search_params']['fields'].extend(['credit_limit', 'total_due', 'use_partner_credit_limit'])
        return result

    def _loader_params_res_company(self):
        result = super()._loader_params_res_company()
        if self.user_has_groups('account.group_account_readonly'):
            result['search_params']['fields'].extend(['account_use_credit_limit'])
        return result
