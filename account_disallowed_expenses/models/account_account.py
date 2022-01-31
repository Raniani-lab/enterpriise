# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class AccountAccount(models.Model):
    _inherit = "account.account"

    disallowed_expenses_category_id = fields.Many2one('account.disallowed.expenses.category', string='Disallowed Expenses Category', domain="['|', ('company_id', '=', company_id), ('company_id', '=', False)]")

    @api.onchange('user_type_id')
    def _onchange_user_type_id(self):
        if self.user_type_id.internal_group not in ('income', 'expense'):
            self.disallowed_expenses_category_id = None
