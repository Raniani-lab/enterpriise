# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class AssetModify(models.TransientModel):
    _name = 'asset.modify'
    _description = 'Modify Asset'

    name = fields.Text(string='Reason')
    asset_id = fields.Many2one(string="Asset", comodel_name='account.asset', required=True, help="The asset to be modified by this wizard", ondelete="cascade")
    method_number = fields.Integer(string='Number of Depreciations', required=True)
    method_period = fields.Selection([('1', 'Months'), ('12', 'Years')], string='Number of Months in a Period',
        help="The amount of time between two depreciations")
    value_residual = fields.Monetary(string="Residual Amount", help="New residual amount for the asset")
    salvage_value = fields.Monetary(string="Salvage Amount", help="New salvage amount for the asset")
    currency_id = fields.Many2one(related='asset_id.currency_id')
    resume_date = fields.Date(default=fields.Date.today())
    need_date = fields.Boolean(compute="_compute_need_date")

    @api.model
    def create(self, vals):
        if 'asset_id' in vals:
            asset = self.env['account.asset'].browse(vals['asset_id'])
            if 'method_number' not in vals:
                vals.update({'method_number': asset.method_number})
            if 'method_period' not in vals:
                vals.update({'method_period': asset.method_period})
            if 'salvage_value' not in vals:
                vals.update({'salvage_value': asset.salvage_value})
            if 'value_residual' not in vals:
                vals.update({'value_residual': asset.value_residual})
        return super(AssetModify, self).create(vals)

    @api.multi
    def modify(self):
        """ Modifies the duration of asset for calculating depreciation
        and maintains the history of old values, in the chatter.
        """
        old_values = {
            'method_number': self.asset_id.method_number,
            'method_period': self.asset_id.method_period,
            'value_residual': self.asset_id.value_residual,
            'salvage_value': self.asset_id.salvage_value,
        }

        posted_depreciation_move_ids = self.asset_id.depreciation_move_ids.filtered(lambda x: x.state == 'posted')
        already_depreciated_amount = sum([m.amount for m in posted_depreciation_move_ids])
        asset_vals = {
            'method_number': self.method_number,
            'method_period': self.method_period,
            'salvage_value': self.salvage_value,
            # value_residual will be computed based on the new depreciation board
            'value': already_depreciated_amount + self.value_residual,
        }
        if self.need_date:
            asset_vals.update({
                'first_depreciation_date': self.asset_id._get_first_depreciation_date(),
                'prorata_date': self.resume_date,
            })
        if self.env.context.get('resume_after_pause'):
            asset_vals.update({'state': 'open'})
            self.asset_id.message_post(body=_("Asset unpaused"))
        else:
            self = self.with_context(ignore_prorata=True)
        self.asset_id.write(asset_vals)
        self.asset_id.compute_depreciation_board()
        tracked_fields = self.env['account.asset'].fields_get(old_values.keys())
        changes, tracking_value_ids = self.asset_id._message_track(tracked_fields, old_values)
        if changes:
            self.asset_id.message_post(subject=_('Depreciation board modified'), body=self.name, tracking_value_ids=tracking_value_ids)
        return {'type': 'ir.actions.act_window_close'}

    @api.depends('asset_id')
    def _compute_need_date(self):
        for record in self:
            record.need_date = self.env.context.get('resume_after_pause') and record.asset_id.prorata
