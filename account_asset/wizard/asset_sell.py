# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class AssetSell(models.TransientModel):
    _name = 'account.asset.sell'
    _description = 'Sell Asset'

    asset_id = fields.Many2one('account.asset', required=True)
    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)

    action = fields.Selection([('sell', 'Sell'), ('dispose', 'Dispose')], required=True, default='sell')
    invoice_id = fields.Many2one('account.move', string="Disposal Invoice", help="The disposal invoice is needed in order to generate the closing journal entry.", domain="[('type', '=', 'out_invoice'), ('state', '=', 'posted')]")
    invoice_line_id = fields.Many2one('account.move.line', help="There are multiple lines that could be the related to this asset", domain="[('move_id', '=', invoice_id), ('exclude_from_invoice_tab', '=', False)]")
    select_invoice_line_id = fields.Boolean(compute="_compute_select_invoice_line_id")
    gain_account_id = fields.Many2one('account.account', related='company_id.gain_account_id', help="Account used to write the journal item in case of gain", readonly=False)
    loss_account_id = fields.Many2one('account.account', related='company_id.loss_account_id', help="Account used to write the journal item in case of loss", readonly=False)

    @api.depends('invoice_id', 'action')
    def _compute_select_invoice_line_id(self):
        for record in self:
            record.select_invoice_line_id = record.action == 'sell' and len(record.invoice_id.invoice_line_ids) > 1

    def do_action(self):
        self.ensure_one()
        invoice_line = self.env['account.move.line'] if self.action == 'dispose' else self.invoice_line_id or self.invoice_id.invoice_line_ids
        return self.asset_id.set_to_close(invoice_line_id=invoice_line)
