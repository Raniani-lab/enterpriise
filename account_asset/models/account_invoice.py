# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil.relativedelta import relativedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError

from odoo.addons import decimal_precision as dp


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'

    asset_ids = fields.One2many('account.asset', compute="_compute_asset_ids")
    deferred_revenue_ids = fields.One2many('account.asset', compute="_compute_asset_ids")
    number_asset_ids = fields.Integer(compute="_compute_asset_ids")
    number_deferred_revenue_ids = fields.Integer(compute="_compute_asset_ids")
    draft_asset_ids = fields.Boolean(compute="_compute_asset_ids")
    draft_deferred_revenue_ids = fields.Boolean(compute="_compute_asset_ids")

    @api.multi
    def action_cancel(self):
        res = super(AccountInvoice, self).action_cancel()
        self.env['account.asset'].sudo().search([('original_move_line_ids.invoice_id', 'in', self.ids)]).write({'active': False})
        return res

    @api.depends('move_id')
    def _compute_asset_ids(self):
        for record in self:
            assets = record.mapped('move_id.line_ids.asset_id')
            record.asset_ids = assets.filtered(lambda x: x.asset_type == 'purchase')
            record.deferred_revenue_ids = assets.filtered(lambda x: x.asset_type == 'sale')
            record.number_asset_ids = len(record.asset_ids)
            record.number_deferred_revenue_ids = len(record.deferred_revenue_ids)
            record.draft_asset_ids = bool(record.asset_ids.filtered(lambda x: x.state == "draft"))
            record.draft_deferred_revenue_ids = bool(record.deferred_revenue_ids.filtered(lambda x: x.state == "draft"))

    @api.multi
    def action_open_asset_ids(self):
        return {
            'name': _('Assets'),
            'view_mode': 'tree,form',
            'res_model': 'account.asset',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', self.asset_ids.ids)],
        }

    @api.multi
    def action_open_deferred_revenue_ids(self):
        form_view = self.env.ref('account_deferred_revenue.view_account_asset_revenue_form', False) or self.env.ref('account_asset.view_account_asset_form')
        return {
            'name': _('Deferred Revenues'),
            'res_model': 'account.asset',
            'views': [[False, "tree"], [form_view.id, "form"]],
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', self.deferred_revenue_ids.ids)],
        }
