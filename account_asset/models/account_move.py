# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.tools import float_compare
from odoo.tools.misc import formatLang


class AccountMove(models.Model):
    _inherit = 'account.move'

    asset_id = fields.Many2one('account.asset', string='Asset', index=True, ondelete='cascade', copy=False)
    asset_asset_type = fields.Selection(related='asset_id.asset_type')
    asset_remaining_value = fields.Monetary(string='Remaining Value', copy=False)
    asset_depreciated_value = fields.Monetary(string='Cumulative Depreciation', copy=False)
    asset_manually_modified = fields.Boolean(help='This is a technical field stating that a depreciation line has been manually modified. It is used to recompute the depreciation table of an asset/deferred revenue.', copy=False)

    asset_ids = fields.One2many('account.asset', string='Assets', compute="_compute_asset_ids")
    deferred_revenue_ids = fields.One2many('account.asset', compute="_compute_asset_ids")
    number_asset_ids = fields.Integer(compute="_compute_asset_ids")
    number_deferred_revenue_ids = fields.Integer(compute="_compute_asset_ids")
    draft_asset_ids = fields.Boolean(compute="_compute_asset_ids")
    draft_deferred_revenue_ids = fields.Boolean(compute="_compute_asset_ids")

    @api.onchange('amount_total')
    def _onchange_amount(self):
        self.asset_manually_modified = True

    def post(self):
        # OVERRIDE
        res = super(AccountMove, self).post()

        # log the post of a depreciation
        self._log_depreciation_asset()

        # look for any asset to create, in case we just posted a bill on an account
        # configured to automatically create assets
        self._auto_create_asset()
        return res

    def button_cancel(self):
        # OVERRIDE
        res = super(AccountMove, self).button_cancel()

        self.env['account.asset'].sudo().search([('original_move_line_ids.move_id', 'in', self.ids)]).write({'active': False})

        return res

    def _log_depreciation_asset(self):
        for move in self.filtered(lambda m: m.asset_id):
            asset = move.asset_id
            msg = _('Depreciation entry %s posted (%s)') % (move.name, formatLang(self.env, move.amount_total, currency_obj=move.company_id.currency_id))
            asset.message_post(body=msg)

    def _auto_create_asset(self):
        create_list = []
        invoice_list = []
        auto_validate = []
        for move in self:
            if not move.is_invoice():
                continue

            for move_line in move.line_ids:
                if (move_line.account_id.can_create_asset or move_line.account_id.can_create_deferred_revenue) and move_line.account_id.create_asset != 'no':
                    vals = {
                        'name': move_line.name,
                        'company_id': move_line.company_id.id,
                        'currency_id': move_line.company_currency_id.id,
                        'original_move_line_ids': [(6, False, move_line.ids)],
                        'state': 'draft',
                    }
                    model_id = move_line.account_id.asset_model
                    if model_id:
                        vals.update({
                            'model_id': model_id.id,
                        })
                    auto_validate.append(move_line.account_id.create_asset == 'validate')
                    invoice_list.append(move)
                    create_list.append(vals)

        assets = self.env['account.asset'].create(create_list)
        for asset, vals, invoice, validate in zip(assets, create_list, invoice_list, auto_validate):
            if 'model_id' in vals:
                asset._onchange_model_id()
                asset._onchange_method_period()
                if validate:
                    asset.validate()
            if invoice:
                msg = _('Asset created from invoice: <a href=# data-oe-model=account.move data-oe-id=%d>%s</a>') % (invoice.id, invoice.name)
                asset.message_post(body=msg)
        return assets

    @api.model
    def _prepare_move_for_asset_depreciation(self, vals):
        missing_fields = set(['asset_id', 'move_ref', 'amount']) - set(vals)
        if missing_fields:
            raise UserError(_('Some fields are missing {}').format(', '.join(missing_fields)))
        asset = vals['asset_id']
        account_analytic_id = asset.account_analytic_id
        analytic_tag_ids = asset.analytic_tag_ids
        depreciation_date = vals.get('date', fields.Date.context_today(self))
        company_currency = asset.company_id.currency_id
        current_currency = asset.currency_id
        prec = company_currency.decimal_places
        amount = current_currency._convert(vals['amount'], company_currency, asset.company_id, depreciation_date)
        move_line_1 = {
            'name': asset.name,
            'account_id': asset.account_depreciation_id.id,
            'debit': 0.0 if float_compare(amount, 0.0, precision_digits=prec) > 0 else -amount,
            'credit': amount if float_compare(amount, 0.0, precision_digits=prec) > 0 else 0.0,
            'analytic_account_id': account_analytic_id.id if asset.asset_type == 'sale' else False,
            'analytic_tag_ids': [(6, 0, analytic_tag_ids.ids)] if asset.asset_type == 'sale' else False,
            'currency_id': company_currency != current_currency and current_currency.id or False,
            'amount_currency': company_currency != current_currency and - 1.0 * vals['amount_total'] or 0.0,
        }
        move_line_2 = {
            'name': asset.name,
            'account_id': asset.account_depreciation_expense_id.id,
            'credit': 0.0 if float_compare(amount, 0.0, precision_digits=prec) > 0 else -amount,
            'debit': amount if float_compare(amount, 0.0, precision_digits=prec) > 0 else 0.0,
            'analytic_account_id': account_analytic_id.id if asset.asset_type == 'purchase' else False,
            'analytic_tag_ids': [(6, 0, analytic_tag_ids.ids)] if asset.asset_type == 'purchase' else False,
            'currency_id': company_currency != current_currency and current_currency.id or False,
            'amount_currency': company_currency != current_currency and vals['amount_total'] or 0.0,
        }
        move_vals = {
            'ref': vals['move_ref'],
            'date': depreciation_date,
            'journal_id': asset.journal_id.id,
            'line_ids': [(0, 0, move_line_1), (0, 0, move_line_2)],
            'auto_post': asset.state == 'open',
            'asset_id': asset.id,
            'asset_remaining_value': vals['asset_remaining_value'],
            'asset_depreciated_value': vals['asset_depreciated_value'],
            'amount_total': amount,
            'name': '/'
        }
        return move_vals

    @api.depends('line_ids.asset_id')
    def _compute_asset_ids(self):
        for record in self:
            assets = record.mapped('line_ids.asset_id')
            record.asset_ids = assets.filtered(lambda x: x.asset_type == 'purchase')
            record.deferred_revenue_ids = assets.filtered(lambda x: x.asset_type == 'sale')
            record.number_asset_ids = len(record.asset_ids)
            record.number_deferred_revenue_ids = len(record.deferred_revenue_ids)
            record.draft_asset_ids = bool(record.asset_ids.filtered(lambda x: x.state == "draft"))
            record.draft_deferred_revenue_ids = bool(record.deferred_revenue_ids.filtered(lambda x: x.state == "draft"))

    @api.model
    def create_asset_move(self, vals):
        move_vals = self._prepare_move_for_asset_depreciation(vals)
        return self.env['account.move'].create(move_vals)

    def open_asset_view(self):
        return {
            'name': _('Asset'),
            'view_mode': 'form',
            'res_model': 'account.asset',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'res_id': self.asset_id.id,
        }

    def action_open_asset_ids(self):
        return {
            'name': _('Assets'),
            'view_type': 'form',
            'view_mode': 'tree,form',
            'res_model': 'account.asset',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', self.asset_ids.ids)],
        }

    def action_open_deferred_revenue_ids(self):
        form_view = self.env.ref('account_deferred_revenue.view_account_asset_revenue_form', False) or self.env.ref('account_asset.view_account_asset_form')
        return {
            'name': _('Deferred Revenues'),
            'res_model': 'account.asset',
            'views': [[False, "tree"], [form_view.id, "form"]],
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', self.deferred_revenue_ids.ids)],
        }


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    asset_id = fields.Many2one('account.asset', string='Asset Linked', ondelete="set null", help="Asset created from this Journal Item", copy=False)

    def turn_as_asset(self):
        ctx = self.env.context.copy()
        ctx.update({'default_original_move_line_ids': [(6, False, self.env.context['active_ids'])]})
        self.env['account.asset']._check_original_move_line_ids(ctx['default_original_move_line_ids'])
        view = self.browse(self.env.context['active_id']).credit and self.env.ref('account_deferred_revenue.view_account_asset_revenue_modal', False) or self.env.ref('account_asset.view_account_asset_modal')  # If account_deferred_revenue is installed and this is a credit line, take the right view
        return {
            "name": _("Turn as an asset"),
            "type": "ir.actions.act_window",
            "res_model": "account.asset",
            "views": [[view.id, "form"]],
            "target": "new",
            "context": ctx,
        }
