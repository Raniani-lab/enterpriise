# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class AccountAccount(models.Model):
    _inherit = 'account.account'

    asset_model = fields.Many2one('account.asset', domain=[('state', '=', 'model')], help="If this is selected, an asset will be created automatically when Journal Items on this account are posted.")
    create_asset = fields.Selection([('no', 'Do not create'), ('draft', 'Create in draft'), ('validate', 'Create and validate')], required=True, default='no')
    can_create_asset = fields.Boolean(compute="_compute_can_create_asset")
    can_create_deferred_revenue = fields.Boolean(compute="_compute_can_create_asset")
    form_view_ref = fields.Char(compute='_compute_can_create_asset')
    asset_type = fields.Selection([('sale', 'Deferred Revenue'), ('purchase', 'Asset')], compute='_compute_can_create_asset')

    @api.depends('user_type_id')
    def _compute_can_create_asset(self):
        for record in self:
            record.can_create_asset = record.auto_generate_asset()
            record.can_create_deferred_revenue = record.auto_generate_deferre_revenue()
            record.form_view_ref = record.can_create_deferred_revenue and self.env.ref('account_deferred_revenue.view_account_asset_revenue_form', False) and 'account_deferred_revenue.view_account_asset_revenue_form' or 'account_asset.view_account_asset_form'
            record.asset_type = record.can_create_deferred_revenue and 'sale' or 'purchase'

    @api.onchange('user_type_id', 'create_asset')
    def _onchange_user_type_id(self):
        self._compute_can_create_asset()
        return {'domain': {'asset_model': [('state', '=', 'model'), ('asset_type', '=', self.can_create_asset and 'purchase' or 'sale')]}}

    def auto_generate_asset(self):
        return self.user_type_id in self.get_asset_accounts_type()

    def auto_generate_deferre_revenue(self):
        return self.user_type_id in self.get_deferred_revenue_accounts_type()

    def get_asset_accounts_type(self):
        return self.env.ref('account.data_account_type_fixed_assets') + self.env.ref('account.data_account_type_non_current_assets')

    def get_deferred_revenue_accounts_type(self):
        return self.env.ref('account.data_account_type_current_liabilities') + self.env.ref('account.data_account_type_non_current_liabilities')
