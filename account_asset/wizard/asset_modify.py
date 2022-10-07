# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError
from odoo.tools.misc import format_date
from odoo.tools import float_compare


class AssetModify(models.TransientModel):
    _name = 'asset.modify'
    _description = 'Modify Asset'

    name = fields.Text(string='Note')
    asset_id = fields.Many2one(string="Asset", comodel_name='account.asset', required=True, help="The asset to be modified by this wizard", ondelete="cascade")
    method_number = fields.Integer(string='Duration', required=True)
    method_period = fields.Selection([('1', 'Months'), ('12', 'Years')], string='Number of Months in a Period', help="The amount of time between two depreciations")
    value_residual = fields.Monetary(string="Depreciable Amount", help="New residual amount for the asset")
    salvage_value = fields.Monetary(string="Not Depreciable Amount", help="New salvage amount for the asset")
    currency_id = fields.Many2one(related='asset_id.currency_id')
    date = fields.Date(default=lambda self: fields.Date.today(), string='Date')
    select_invoice_line_id = fields.Boolean(compute="_compute_select_invoice_line_id")
    # if we should display the fields for the creation of gross increase asset
    gain_value = fields.Boolean(compute="_compute_gain_value")

    account_asset_id = fields.Many2one('account.account', string="Gross Increase Account", domain="[('deprecated', '=', False), ('company_id', '=', company_id)]")
    account_asset_counterpart_id = fields.Many2one('account.account', domain="[('deprecated', '=', False), ('company_id', '=', company_id)]", string="Asset Counterpart Account")
    account_depreciation_id = fields.Many2one('account.account', domain="[('deprecated', '=', False), ('company_id', '=', company_id)]", string="Depreciation Account")
    account_depreciation_expense_id = fields.Many2one('account.account', domain="[('deprecated', '=', False), ('company_id', '=', company_id)]", string="Expense Account")
    modify_action = fields.Selection(selection="_get_selection_modify_options", string="Action")
    company_id = fields.Many2one('res.company', related='asset_id.company_id')

    invoice_ids = fields.Many2many(
        comodel_name='account.move',
        string="Customer Invoice",
        domain="[('move_type', '=', 'out_invoice'), ('state', '=', 'posted')]",
        help="The disposal invoice is needed in order to generate the closing journal entry.",
    )
    invoice_line_ids = fields.Many2many(
        comodel_name='account.move.line',
        domain="[('move_id', '=', invoice_id), ('display_type', '=', 'product')]",
        help="There are multiple lines that could be the related to this asset",
    )
    gain_account_id = fields.Many2one(
        comodel_name='account.account',
        domain="[('deprecated', '=', False), ('company_id', '=', company_id)]",
        compute="_compute_accounts", inverse="_inverse_gain_account", readonly=False, compute_sudo=True,
        help="Account used to write the journal item in case of gain",
    )
    loss_account_id = fields.Many2one(
        comodel_name='account.account',
        domain="[('deprecated', '=', False), ('company_id', '=', company_id)]",
        compute="_compute_accounts", inverse="_inverse_loss_account", readonly=False, compute_sudo=True,
        help="Account used to write the journal item in case of loss",
    )

    informational_text = fields.Html(compute='_compute_informational_text')

    # Technical field to know if there was a profit or a loss in the selling of the asset
    gain_or_loss = fields.Selection([('gain', 'Gain'), ('loss', 'Loss'), ('no', 'No')], compute='_compute_gain_or_loss')

    def _compute_modify_action(self):
        if self.env.context.get('resume_after_pause'):
            return 'resume'
        else:
            return 'dispose'

    @api.depends('asset_id')
    def _get_selection_modify_options(self):
        options = [
            ('dispose', "Dispose"),
            ('sell', "Sell"),
            ('modify', "Re-evaluate"),
            ('pause', "Pause"),
        ]
        if self.env.context.get('resume_after_pause'):
            options = [('resume', 'Resume')]
        return options

    @api.depends('company_id')
    def _compute_accounts(self):
        for record in self:
            record.gain_account_id = record.company_id.gain_account_id
            record.loss_account_id = record.company_id.loss_account_id

    def _inverse_gain_account(self):
        for record in self:
            record.company_id.sudo().gain_account_id = record.gain_account_id

    def _inverse_loss_account(self):
        for record in self:
            record.company_id.sudo().loss_account_id = record.loss_account_id

    @api.onchange('modify_action')
    def _onchange_action(self):
        if self.modify_action == 'sell' and self.asset_id.children_ids.filtered(lambda a: a.state in ('draft', 'open') or a.value_residual > 0):
            raise UserError(_("You cannot automate the journal entry for an asset that has a running gross increase. Please use 'Dispose' on the increase(s)."))
        if self.modify_action not in ('modify', 'resume'):
            self.write({'value_residual': self.asset_id.value_residual, 'salvage_value': self.asset_id.salvage_value})

    @api.onchange('invoice_ids')
    def _onchange_invoice_ids(self):
        self.invoice_line_ids = self.invoice_ids.invoice_line_ids.filtered(lambda line: line._origin.id in self.invoice_line_ids.ids)  # because the domain filter doesn't apply and the invoice_line_ids remains selected
        for invoice in self.invoice_ids.filtered(lambda inv: len(inv.invoice_line_ids) == 1):
            self.invoice_line_ids += invoice.invoice_line_ids

    @api.depends('asset_id', 'invoice_ids', 'invoice_line_ids', 'modify_action')
    def _compute_gain_or_loss(self):
        for record in self:
            balances = abs(sum([invoice.balance for invoice in record.invoice_line_ids]))
            if record.modify_action in ('sell', 'dispose') and record.asset_id.value_residual < balances:
                record.gain_or_loss = 'gain'
            elif record.modify_action in ('sell', 'dispose') and record.asset_id.value_residual > balances:
                record.gain_or_loss = 'loss'
            else:
                record.gain_or_loss = 'no'

    @api.depends('loss_account_id', 'gain_account_id', 'gain_or_loss', 'modify_action', 'date', 'value_residual', 'salvage_value')
    def _compute_informational_text(self):
        for wizard in self:
            if wizard.modify_action == 'dispose':
                if wizard.gain_or_loss == 'gain':
                    account = wizard.gain_account_id.display_name or ''
                    gain_or_loss = 'gain'
                elif wizard.gain_or_loss == 'loss':
                    account = wizard.loss_account_id.display_name or ''
                    gain_or_loss = 'loss'
                else:
                    account = ''
                    gain_or_loss = 'gain/loss'
                wizard.informational_text = _(
                    "A depreciation entry will be posted on and including the date %s."
                    "<br/> A disposal entry will be posted on the %s account <b>%s</b>.",
                    format_date(self.env, wizard.date), gain_or_loss, account
                )
            elif wizard.modify_action == 'sell':
                if wizard.gain_or_loss == 'gain':
                    account = wizard.gain_account_id.display_name or ''
                elif wizard.gain_or_loss == 'loss':
                    account = wizard.loss_account_id.display_name or ''
                else:
                    account = ''
                wizard.informational_text = _(
                    "A depreciation entry will be posted on and including the date %s."
                    "<br/> A second entry will neutralize the original income and post the  "
                    "outcome of this sale on account <b>%s</b>.",
                    format_date(self.env, wizard.date), account
                )
            elif wizard.modify_action == 'pause':
                wizard.informational_text = _(
                    "A depreciation entry will be posted on and including the date %s.",
                    format_date(self.env, wizard.date)
                )
            elif wizard.modify_action == 'modify':
                if wizard.gain_value:
                    text = _("An asset will be created for the value increase of the asset. <br/>")
                else:
                    text = ""
                wizard.informational_text = _(
                    "A depreciation entry will be posted on and including the date %s. <br/> %s "
                    "Future entries will be recomputed to depreciate the asset following the changes.",
                    format_date(self.env, wizard.date), text
                )

            else:
                if wizard.gain_value:
                    text = _("An asset will be created for the value increase of the asset. <br/>")
                else:
                    text = ""
                wizard.informational_text = _("%s Future entries will be recomputed to depreciate the asset following the changes.", text)

    @api.depends('invoice_ids', 'modify_action')
    def _compute_select_invoice_line_id(self):
        for record in self:
            record.select_invoice_line_id = record.modify_action == 'sell' and len(record.invoice_ids.invoice_line_ids) > 1

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if 'asset_id' in vals:
                asset = self.env['account.asset'].browse(vals['asset_id'])
                if asset.depreciation_move_ids.filtered(lambda m: m.state == 'posted' and not m.reversal_move_id and m.date > fields.Date.today()):
                    raise UserError(_('Reverse the depreciation entries posted in the future in order to modify the depreciation'))
                if 'method_number' not in vals:
                    vals.update({'method_number': asset.method_number})
                if 'method_period' not in vals:
                    vals.update({'method_period': asset.method_period})
                if 'salvage_value' not in vals:
                    vals.update({'salvage_value': asset.salvage_value})
                if 'value_residual' not in vals:
                    vals.update({'value_residual': asset.value_residual})
                if 'account_asset_id' not in vals:
                    vals.update({'account_asset_id': asset.account_asset_id.id})
                if 'account_depreciation_id' not in vals:
                    vals.update({'account_depreciation_id': asset.account_depreciation_id.id})
                if 'account_depreciation_expense_id' not in vals:
                    vals.update({'account_depreciation_expense_id': asset.account_depreciation_expense_id.id})
        return super().create(vals_list)

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

        asset_vals = {
            'method_number': self.method_number,
            'method_period': self.method_period,
            'value_residual': self.value_residual,
            'salvage_value': self.salvage_value,
        }
        if self.env.context.get('resume_after_pause'):
            date_before_pause = max(self.asset_id.depreciation_move_ids, key=lambda x: x.date).date if self.asset_id.depreciation_move_ids else self.asset_id.acquisition_date
            # We are removing one day to number days because we don't count the current day
            # i.e. If we pause and resume the same day, there isn't any gap whereas for depreciation
            # purpose it would count as one full day
            number_days = self.asset_id._get_delta_days(date_before_pause, self.date) - 1
            if float_compare(number_days, 0, precision_rounding=self.currency_id.rounding) < 0:
                raise UserError(_("You cannot resume at a date equal to or before the pause date"))

            asset_vals.update({'asset_paused_days': self.asset_id.asset_paused_days + number_days})
            asset_vals.update({'state': 'open'})
            self.asset_id.message_post(body=_("Asset unpaused. %s", self.name))

        current_asset_book = self.asset_id.value_residual + self.asset_id.salvage_value
        after_asset_book = self.value_residual + self.salvage_value
        increase = after_asset_book - current_asset_book

        new_residual = min(current_asset_book - min(self.salvage_value, self.asset_id.salvage_value), self.value_residual)
        new_salvage = min(current_asset_book - new_residual, self.salvage_value)
        residual_increase = max(0, self.value_residual - new_residual)
        salvage_increase = max(0, self.salvage_value - new_salvage)

        # Check for residual/salvage increase while rounding with the company currency precision to prevent float precision issues.
        if self.currency_id.round(residual_increase + salvage_increase) > 0:
            move = self.env['account.move'].create({
                'journal_id': self.asset_id.journal_id.id,
                'date': fields.Date.today(),
                'move_type': 'entry',
                'line_ids': [
                    Command.create({
                        'account_id': self.account_asset_id.id,
                        'debit': residual_increase + salvage_increase,
                        'credit': 0,
                        'name': _('Value increase for: %(asset)s', asset=self.asset_id.name),
                    }),
                    Command.create({
                        'account_id': self.account_asset_counterpart_id.id,
                        'debit': 0,
                        'credit': residual_increase + salvage_increase,
                        'name': _('Value increase for: %(asset)s', asset=self.asset_id.name),
                    }),
                ],
            })
            move._post()
            asset_increase = self.env['account.asset'].create({
                'name': self.asset_id.name + ': ' + self.name if self.name else "",
                'currency_id': self.asset_id.currency_id.id,
                'company_id': self.asset_id.company_id.id,
                'asset_type': self.asset_id.asset_type,
                'method': self.asset_id.method,
                'method_number': self.method_number,
                'method_period': self.method_period,
                'acquisition_date': self.asset_id.acquisition_date,
                'value_residual': residual_increase,
                'salvage_value': salvage_increase,
                'prorata_date': self.asset_id.prorata_date,
                'prorata_computation_type': self.asset_id.prorata_computation_type,
                'original_value': residual_increase + salvage_increase,
                'account_asset_id': self.account_asset_id.id,
                'account_depreciation_id': self.account_depreciation_id.id,
                'account_depreciation_expense_id': self.account_depreciation_expense_id.id,
                'journal_id': self.asset_id.journal_id.id,
                'parent_id': self.asset_id.id,
                'original_move_line_ids': [(6, 0, move.line_ids.filtered(lambda r: r.account_id == self.account_asset_id).ids)],
            })
            asset_increase.validate()

            subject = _('A gross increase has been created: %s', asset_increase._get_html_link())
            self.asset_id.message_post(body=subject)

        if not self.env.context.get('resume_after_pause'):
            self.asset_id._create_move_before_date(self.date)
        if increase < 0:
            if self.env['account.move'].search([('asset_id', '=', self.asset_id.id), ('state', '=', 'draft'), ('date', '<=', self.date)]):
                raise UserError('There are unposted depreciations prior to the selected operation date, please deal with them first.')
            move = self.env['account.move'].create(self.env['account.move']._prepare_move_for_asset_depreciation({
                'amount': -increase,
                'asset_id': self.asset_id,
                'move_ref': _('Value decrease for: %(asset)s', asset=self.asset_id.name),
                'depreciation_beginning_date': self.date,
                'depreciation_end_date': self.date,
                'date': self.date,
                'asset_number_days': 0,
                'asset_value_change': True,
            }))._post()

        asset_vals.update({
            'value_residual': new_residual,
            'salvage_value': new_salvage,
        })
        self.asset_id.write(asset_vals)

        self.asset_id.compute_depreciation_board()

        self.asset_id.children_ids.write({
            'method_number': asset_vals['method_number'],
            'method_period': asset_vals['method_period'],
            'acquisition_date': self.asset_id.acquisition_date,
            'asset_paused_days': self.asset_id.asset_paused_days,
            'prorata_date': self.asset_id.prorata_date,
            'prorata_computation_type': self.asset_id.prorata_computation_type,
        })

        for child in self.asset_id.children_ids:
            child.compute_depreciation_board()
            child._check_depreciations()
            child.depreciation_move_ids.filtered(lambda move: move.state != 'posted')._post()
        tracked_fields = self.env['account.asset'].fields_get(old_values.keys())
        changes, tracking_value_ids = self.asset_id._mail_track(tracked_fields, old_values)
        if changes:
            self.asset_id.message_post(body=_('Depreciation board modified %s', self.name), tracking_value_ids=tracking_value_ids)
        self.asset_id._check_depreciations()
        self.asset_id.depreciation_move_ids.filtered(lambda move: move.state != 'posted')._post()
        return {'type': 'ir.actions.act_window_close'}

    def pause(self):
        for record in self:
            record.asset_id.pause(pause_date=record.date, message=self.name)

    def sell_dispose(self):
        self.ensure_one()
        invoice_lines = self.env['account.move.line'] if self.modify_action == 'dispose' else self.invoice_line_ids
        #TODO to check with TSB
        return self.asset_id.set_to_close(invoice_line_ids=invoice_lines, date=self.date, message=self.name)

    @api.depends('asset_id', 'value_residual', 'salvage_value')
    def _compute_gain_value(self):
        for record in self:
            record.gain_value = record.value_residual + record.salvage_value > record.asset_id.value_residual + record.asset_id.salvage_value
