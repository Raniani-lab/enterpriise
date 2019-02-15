# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import calendar
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from lxml import etree

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import float_compare, float_is_zero, float_round


class AccountAsset(models.Model):
    _name = 'account.asset'
    _description = 'Asset/Revenue Recognition'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    depreciation_entries_count = fields.Integer(compute='_entry_count', string='# Posted Depreciation Entries')
    total_depreciation_entries_count = fields.Integer(compute='_entry_count', string='# Depreciation Entries')

    name = fields.Char(string='Asset Name', required=True, readonly=True, states={'draft': [('readonly', False)], 'model': [('readonly', False)]})
    value = fields.Monetary(string='Gross Value', compute='_compute_value', inverse='_set_value', readonly=True, states={'draft': [('readonly', False)]}, store=True)
    currency_id = fields.Many2one('res.currency', string='Currency', required=True, readonly=True, states={'draft': [('readonly', False)]},
        default=lambda self: self.env.user.company_id.currency_id.id)
    company_id = fields.Many2one('res.company', string='Company', required=True, readonly=True, states={'draft': [('readonly', False)]},
        default=lambda self: self.env['res.company']._company_default_get('account.asset'))
    state = fields.Selection([('model', 'Model'), ('draft', 'Draft'), ('open', 'Running'), ('paused', 'On Hold'), ('close', 'Closed')], 'Status', copy=False, default='draft',
        help="When an asset is created, the status is 'Draft'.\n"
            "If the asset is confirmed, the status goes in 'Running' and the depreciation lines can be posted in the accounting.\n"
            "The 'On Hold' status can be set manually when you want to pause the depreciation of an asset for some time.\n"
            "You can manually close an asset when the depreciation is over. If the last line of depreciation is posted, the asset automatically goes in that status.")
    active = fields.Boolean(default=True)
    method = fields.Selection([('linear', 'Linear'), ('degressive', 'Degressive'), ('degressive_then_linear', 'Accelerated Degressive')], string='Computation Method', readonly=True, states={'draft': [('readonly', False)], 'model': [('readonly', False)]}, default='linear',
        help="Choose the method to use to compute the amount of depreciation lines.\n"
            "  * Linear: Calculated on basis of: Gross Value / Number of Depreciations\n"
            "  * Degressive: Calculated on basis of: Residual Value * Degressive Factor\n"
            "  * Accelerated Degressive: Like Degressive but with a minimum depreciation value equal to the linear value.")
    method_number = fields.Integer(string='Number of Depreciations', readonly=True, states={'draft': [('readonly', False)], 'model': [('readonly', False)]}, default=5, help="The number of depreciations needed to depreciate your asset")
    method_period = fields.Selection([('1', 'Months'), ('12', 'Years')], string='Number of Months in a Period', readonly=True, default='12', states={'draft': [('readonly', False)], 'model': [('readonly', False)]},
        help="The amount of time between two depreciations")
    method_progress_factor = fields.Float(string='Degressive Factor', readonly=True, default=0.3, states={'draft': [('readonly', False)], 'model': [('readonly', False)]})
    value_residual = fields.Monetary(compute='_amount_residual', method=True, digits=0, string='Residual Value', store=True)
    prorata = fields.Boolean(string='Prorata Temporis', readonly=True, states={'draft': [('readonly', False)], 'model': [('readonly', False)]},
        help='Indicates that the first depreciation entry for this asset have to be done from the asset date (purchase date) instead of the first January / Start date of fiscal year')
    prorata_date = fields.Date(
        string='Prorata Date',
        readonly=True, states={'draft': [('readonly', False)]})
    depreciation_move_ids = fields.One2many('account.move', 'asset_id', string='Depreciation Lines', readonly=True, states={'draft': [('readonly', False)], 'open': [('readonly', False)], 'paused': [('readonly', False)]})
    salvage_value = fields.Monetary(string='Salvage Value', digits=0, readonly=True, states={'draft': [('readonly', False)]},
        help="It is the amount you plan to have that you cannot depreciate.")
    original_move_line_ids = fields.One2many('account.move.line', 'asset_id', string='Journal Items', readonly=True, states={'draft': [('readonly', False)]}, copy=False)
    asset_type = fields.Selection([('sale', 'Sale: Revenue Recognition'), ('purchase', 'Purchase: Asset')], index=True, readonly=False, states={'draft': [('readonly', False)]}, store=True)
    account_analytic_id = fields.Many2one('account.analytic.account', string='Analytic Account')
    analytic_tag_ids = fields.Many2many('account.analytic.tag', string='Analytic Tag')
    first_depreciation_date = fields.Date(
        string='First Depreciation Date',
        readonly=True, states={'draft': [('readonly', False)]}, required=True,
        help='Note that this date does not alter the computation of the first journal entry in case of prorata temporis assets. It simply changes its accounting date',
    )
    disposal_date = fields.Date()

    account_asset_id = fields.Many2one('account.account', string='Fixed Asset Account', compute='_compute_value', help="Account used to record the purchase of the asset at its original price.", store=True, readonly=False)
    account_depreciation_id = fields.Many2one('account.account', string='Depreciation Account', readonly=True, states={'draft': [('readonly', False)], 'model': [('readonly', False)]}, domain=[('internal_type', '=', 'other'), ('deprecated', '=', False)], help="Account used in the depreciation entries, to decrease the asset value.")
    account_depreciation_expense_id = fields.Many2one('account.account', string='Expense Account', readonly=True, states={'draft': [('readonly', False)], 'model': [('readonly', False)]}, domain=[('internal_type', '=', 'other'), ('deprecated', '=', False)], oldname='account_income_recognition_id', help="Account used in the periodical entries, to record a part of the asset as expense.")

    journal_id = fields.Many2one('account.journal', string='Journal', readonly=True, states={'draft': [('readonly', False)], 'model': [('readonly', False)]}, domain=[('type', '=', 'general')])

    # model-related fields
    model_id = fields.Many2one('account.asset', string='Model', change_default=True, readonly=True, states={'draft': [('readonly', False)]})
    user_type_id = fields.Many2one('account.account.type', related="account_asset_id.user_type_id", string="Type of the account")
    display_warning_account_type = fields.Boolean(compute="_compute_value")
    display_model_choice = fields.Boolean(compute="_compute_value")
    display_account_asset_id = fields.Boolean(compute="_compute_value")

    @api.depends('original_move_line_ids', 'original_move_line_ids.account_id')
    def _compute_value(self):
        misc_journal_id = self.env['account.journal'].search([('type', '=', 'general')], limit=1)
        for record in self:
            if not record.original_move_line_ids:
                record.display_model_choice = record.state == 'draft'
                record.display_account_asset_id = True
                continue
            if any(line.move_id.state == 'draft' for line in record.original_move_line_ids):
                raise UserError(_("All the lines should be posted"))
            if any(account != record.original_move_line_ids[0].account_id for account in record.original_move_line_ids.mapped('account_id')):
                raise UserError(_("All the lines should be from the same account"))
            record.account_asset_id = record.original_move_line_ids[0].account_id
            record.display_warning_account_type = not record.account_asset_id.can_create_asset and not record.account_asset_id.can_create_deferred_revenue
            record.display_model_choice = record.state == 'draft' and len(self.env['account.asset'].search([('state', '=', 'model'), ('account_asset_id.user_type_id', '=', record.user_type_id.id)]))
            record.display_account_asset_id = False
            record.name = record.original_move_line_ids[0].name
            if not record.journal_id:
                record.journal_id = misc_journal_id
            record.value = sum(line.credit+line.debit for line in record.original_move_line_ids)
            record.first_depreciation_date = record._get_first_depreciation_date()

    def _set_value(self):
        for record in self:
            if record.original_move_line_ids:
                is_debit = any(line.credit == 0 for line in record.original_move_line_ids)
                is_credit = any(line.debit == 0 for line in record.original_move_line_ids)
                if is_debit and is_credit:
                    raise UserError(_("You cannot create an asset from lines containing credit and debit on the account or with a null amount"))
                if is_debit:
                    record.asset_type = 'purchase'
                else:
                    record.asset_type = 'sale'
            if not record.asset_type and 'asset_type' in self.env.context:
                record.asset_type = self.env.context['asset_type']
            if not record.account_asset_id:
                record.account_asset_id = record.account_depreciation_id if record.asset_type == 'purchase' else record.account_depreciation_expense_id

    @api.onchange('value')
    def _onchange_value(self):
        self._set_value()

    @api.onchange('method_period')
    def _onchange_method_period(self):
        self.first_depreciation_date = self._get_first_depreciation_date()

    @api.onchange('prorata')
    def _onchange_prorata(self):
        if self.prorata:
            self.prorata_date = fields.Date.today()

    @api.onchange('depreciation_move_ids')
    def _onchange_depreciation_move_ids(self):
        seq = 0
        asset_remaining_value = self.value
        cumulated_depreciation = 0
        for m in self.depreciation_move_ids.sorted(lambda x: x.date):
            seq += 1
            asset_remaining_value -= m.amount
            cumulated_depreciation += m.amount
            if not m.asset_manually_modified:
                continue
            m.asset_manually_modified = False
            m.asset_remaining_value = asset_remaining_value
            m.asset_depreciated_value = cumulated_depreciation
            for older_move in self.depreciation_move_ids.sorted(lambda x: x.date)[seq:]:
                asset_remaining_value -= older_move.amount
                cumulated_depreciation += older_move.amount
                older_move.asset_remaining_value = asset_remaining_value
                older_move.asset_depreciated_value = cumulated_depreciation

    @api.onchange('account_depreciation_id')
    def _onchange_account_depreciation_id(self):
        if self.asset_type == 'sale' and self.state == 'model':
            self.account_asset_id = self.account_depreciation_id  # account_asset_id is not displayed in the sale-model form but is technicaly required

    @api.onchange('account_asset_id')
    def _onchange_account_asset_id(self):
        self._onchange_value()
        self.display_model_choice = self.state == 'draft' and len(self.env['account.asset'].search([('state', '=', 'model'), ('account_asset_id.user_type_id', '=', self.user_type_id.id)]))
        if self.asset_type == 'purchase':
            self.account_depreciation_id = self.account_depreciation_id or self.account_asset_id
        else:
            self.account_depreciation_expense_id = self.account_depreciation_expense_id or self.account_asset_id

    @api.onchange('model_id')
    def _onchange_model_id(self):
        model = self.model_id
        if model:
            self.method = model.method
            self.method_number = model.method_number
            self.method_period = model.method_period
            self.method_progress_factor = model.method_progress_factor
            self.prorata = model.prorata
            self.prorata_date = fields.Date.today()
            self.account_analytic_id = model.account_analytic_id.id
            self.analytic_tag_ids = [(6, 0, model.analytic_tag_ids.ids)]
            self.account_depreciation_id = model.account_depreciation_id
            self.account_depreciation_expense_id = model.account_depreciation_expense_id
            self.journal_id = model.journal_id

    @api.onchange('asset_type')
    def _onchange_type(self):
        if self.state != 'model':
            if self.asset_type == 'sale':
                self.prorata = True
                self.method_period = '1'
            else:
                self.method_period = '12'

    def _get_first_depreciation_date(self, vals={}):
        pre_depreciation_date = vals.get('date') or min(self.original_move_line_ids.mapped('date'), default=fields.Date.today())
        depreciation_date = pre_depreciation_date + relativedelta(day=31)
        # ... or fiscalyear depending the number of period
        if '12' in (self.method_period, vals.get('method_period')):
            depreciation_date = depreciation_date + relativedelta(month=int(self.company_id.fiscalyear_last_month))
            depreciation_date = depreciation_date + relativedelta(day=self.company_id.fiscalyear_last_day)
            if depreciation_date < pre_depreciation_date:
                depreciation_date = depreciation_date + relativedelta(years=1)
        return depreciation_date

    @api.multi
    def unlink(self):
        for asset in self:
            if asset.state in ['open', 'paused', 'close']:
                raise UserError(_('You cannot delete a document that is in %s state.') % _(asset.state,))
        return super(AccountAsset, self).unlink()

    def _compute_board_amount(self, computation_sequence, residual_amount, total_amount_to_depr, max_depreciation_nb, starting_sequence, depreciation_date):
        amount = 0
        if computation_sequence == max_depreciation_nb:
            # last depreciation always takes the asset residual amount
            amount = residual_amount
        else:
            if self.method in ('degressive', 'degressive_then_linear'):
                amount = residual_amount * self.method_progress_factor
            if self.method in ('linear', 'degressive_then_linear'):
                nb_depreciation = max_depreciation_nb - starting_sequence
                if self.prorata:
                    nb_depreciation -= 1
                linear_amount = min(total_amount_to_depr / nb_depreciation, residual_amount)
                if self.method == 'degressive_then_linear':
                    amount = max(linear_amount, amount)
                else:
                    amount = linear_amount
        return amount

    def compute_depreciation_board(self):
        self.ensure_one()
        # if self.value == 0:
        #     return
        posted_depreciation_move_ids = self.depreciation_move_ids.filtered(lambda x: x.state == 'posted').sorted(key=lambda l: l.date)
        already_depreciated_amount = sum([m.amount for m in posted_depreciation_move_ids])
        depreciation_number = self.method_number
        if self.prorata:
            depreciation_number += 1
        starting_sequence = 0
        amount_to_depreciate = self.value_residual
        depreciation_date = self.first_depreciation_date
        # if we already have some previous validated entries, starting date is last entry + method period
        if posted_depreciation_move_ids and posted_depreciation_move_ids[-1].date:
            last_depreciation_date = fields.Date.from_string(posted_depreciation_move_ids[-1].date)
            if last_depreciation_date > depreciation_date:  # in case we unpause the asset
                depreciation_date = last_depreciation_date + relativedelta(months=+int(self.method_period))
        commands = [(2, line_id.id, False) for line_id in self.depreciation_move_ids.filtered(lambda x: x.state == 'draft')]
        newlines = self._recompute_board(depreciation_number, starting_sequence, amount_to_depreciate, depreciation_date, already_depreciated_amount)
        for newline_vals in newlines:
            # no need of amount field, as it is computed and we don't want to trigger its inverse function
            del(newline_vals['amount'])
            newLine = self.env['account.move'].create(newline_vals)
            commands.append((4, newLine.id, False))
        return self.write({'depreciation_move_ids': commands})

    def _recompute_board(self, depreciation_number, starting_sequence, amount_to_depreciate, depreciation_date, already_depreciated_amount):
        self.ensure_one()
        residual_amount = amount_to_depreciate
        # Remove old unposted depreciation lines. We cannot use unlink() with One2many field
        move_vals = []
        prorata = self.prorata and not self.env.context.get("ignore_prorata")
        if amount_to_depreciate != 0.0:
            for asset_sequence in range(starting_sequence + 1, depreciation_number + 1):
                amount = self._compute_board_amount(asset_sequence, residual_amount, amount_to_depreciate, depreciation_number, starting_sequence, depreciation_date)
                prorata_factor = 1
                move_ref = self.name + ' (%s/%s)' % (prorata and asset_sequence - 1 or asset_sequence, self.method_number)
                if prorata and asset_sequence == 1:
                    move_ref = self.name + ' ' + _('(prorata entry)')
                    first_date = self.prorata_date
                    if int(self.method_period) % 12 != 0:
                        month_days = calendar.monthrange(first_date.year, first_date.month)[1]
                        days = month_days - first_date.day + 1
                        prorata_factor = days / month_days
                    else:
                        total_days = (depreciation_date.year % 4) and 365 or 366
                        days = (self.company_id.compute_fiscalyear_dates(first_date)['date_to'] - first_date).days + 1
                        prorata_factor = days / total_days
                amount = self.currency_id.round(amount * prorata_factor)
                if float_is_zero(amount, precision_rounding=self.currency_id.rounding):
                    continue
                residual_amount -= amount

                move_vals.append(self.env['account.move']._prepare_move_for_asset_depreciation({
                    'amount': amount,
                    'asset_id': self,
                    'move_ref': move_ref,
                    'date': depreciation_date,
                    'asset_remaining_value': float_round(residual_amount, precision_rounding=self.currency_id.rounding),
                    'asset_depreciated_value': amount_to_depreciate - residual_amount + already_depreciated_amount,
                }))

                depreciation_date = depreciation_date + relativedelta(months=+int(self.method_period))
                # datetime doesn't take into account that the number of days is not the same for each month
                if (not self.prorata or self.env.context.get("ignore_prorata")) and int(self.method_period) % 12 != 0:
                    max_day_in_month = calendar.monthrange(depreciation_date.year, depreciation_date.month)[1]
                    depreciation_date = depreciation_date.replace(day=max_day_in_month)
        return move_vals

    def action_asset_modify(self):
        """ Returns an action opening the asset modification wizard.
        """
        self.ensure_one()
        new_wizard = self.env['asset.modify'].create({
            'asset_id': self.id,
        })
        return {
            'name': _('Modify Asset'),
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'asset.modify',
            'type': 'ir.actions.act_window',
            'target': 'new',
            'res_id': new_wizard.id,
            'context': self.env.context,
        }

    def action_asset_pause(self):
        """ Returns an action opening the asset pause wizard."""
        self.ensure_one()
        new_wizard = self.env['account.asset.pause'].create({
            'asset_id': self.id,
            'action': 'pause',
        })
        return {
            'name': _('Pause Asset'),
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'account.asset.pause',
            'type': 'ir.actions.act_window',
            'target': 'new',
            'res_id': new_wizard.id,
        }

    def action_set_to_close(self):
        """ Returns an action opening the asset pause wizard."""
        self.ensure_one()
        new_wizard = self.env['account.asset.pause'].create({
            'asset_id': self.id,
            'action': 'sell',
        })
        return {
            'name': _('Pause Asset'),
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'account.asset.pause',
            'type': 'ir.actions.act_window',
            'target': 'new',
            'res_id': new_wizard.id,
        }

    @api.multi
    def action_save_model(self):
        form_view = self.env.ref('account_deferred_revenue.view_account_asset_revenue_form', False) or self.env.ref('account_asset.view_account_asset_form')
        return {
            'name': _('Save model'),
            'views': [[form_view.id, "form"]],
            'res_model': 'account.asset',
            'type': 'ir.actions.act_window',
            'context': {
                'default_state': 'model',
                'default_account_asset_id': self.account_asset_id.id,
                'default_account_depreciation_id': self.account_depreciation_id.id,
                'default_account_depreciation_expense_id': self.account_depreciation_expense_id.id,
                'default_journal_id': self.journal_id.id,
                'default_method': self.method,
                'default_method_number': self.method_number,
                'default_method_period': self.method_period,
                'default_progress_factor': self.method_progress_factor,
                'default_prorata': self.prorata,
                'default_prorata_date': self.prorata_date,
                'default_analytic_tag_ids': [(6, 0, self.analytic_tag_ids.ids)],
                'original_asset': self.id,
            }
        }

    @api.multi
    def open_entries(self):
        return {
            'name': _('Journal Entries'),
            'view_type': 'form',
            'view_mode': 'tree,form',
            'res_model': 'account.move',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', self.depreciation_move_ids.ids)],
        }

    @api.multi
    def open_related_entries(self):
        return {
            'name': _('Journal Items'),
            'view_type': 'form',
            'view_mode': 'tree,form',
            'res_model': 'account.move.line',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', self.original_move_line_ids.ids)],
        }

    @api.multi
    def validate(self):
        fields = [
            'method',
            'method_number',
            'method_period',
            'method_progress_factor',
            'salvage_value',
            'invoice_id',
            'original_move_line_ids',
        ]
        ref_tracked_fields = self.env['account.asset'].fields_get(fields)
        self.write({'state': 'open'})
        for asset in self:
            tracked_fields = ref_tracked_fields.copy()
            if asset.method == 'linear':
                del(tracked_fields['method_progress_factor'])
            dummy, tracking_value_ids = asset._message_track(tracked_fields, dict.fromkeys(fields))
            asset.message_post(subject=_('Asset created'), tracking_value_ids=tracking_value_ids)
            msg = _('An asset has been created for this move: <a href="/web#id={id}&model=account.asset">{name}</a>').format(id=asset.id, name=asset.name)
            asset.original_move_line_ids.mapped('move_id').message_post(body=msg)
            if not asset.depreciation_move_ids:
                asset.compute_depreciation_board()
            asset._check_depreciations()
            asset.depreciation_move_ids.write({'auto_post': True})

    def _return_disposal_view(self, move_ids):
        name = _('Disposal Move')
        view_mode = 'form'
        if len(move_ids) > 1:
            name = _('Disposal Moves')
            view_mode = 'tree,form'
        return {
            'name': name,
            'view_type': 'form',
            'view_mode': view_mode,
            'res_model': 'account.move',
            'type': 'ir.actions.act_window',
            'target': 'current',
            'res_id': move_ids[0],
        }

    def _get_disposal_moves(self, disposal_date):
        move_ids = []
        for asset in self:
            unposted_depreciation_move_ids = asset.depreciation_move_ids.filtered(lambda x: x.state == 'draft')
            if unposted_depreciation_move_ids:
                old_values = {
                    'method_number': asset.method_number,
                }

                # Remove all unposted depr. lines
                commands = [(2, line_id.id, False) for line_id in unposted_depreciation_move_ids]

                # Create a new depr. line with the residual amount and post it
                asset_sequence = len(asset.depreciation_move_ids) - len(unposted_depreciation_move_ids) + 1
                vals = {
                    'amount': asset.value_residual,
                    'asset_id': asset,
                    'move_ref': asset.name + ': ' + _('Disposal'),
                    'asset_remaining_value': 0,
                    'asset_depreciated_value': asset.value - asset.salvage_value,  # the asset is completely depreciated
                    'date': disposal_date,
                }
                move_vals = self.env['account.move']._prepare_move_for_asset_depreciation(vals)
                commands.append((0, 0, move_vals))
                asset.write({'depreciation_move_ids': commands, 'method_number': asset_sequence})
                tracked_fields = self.env['account.asset'].fields_get(['method_number'])
                changes, tracking_value_ids = asset._message_track(tracked_fields, old_values)
                if changes:
                    asset.message_post(subject=_('Asset sold or disposed. Accounting entry awaiting for validation.'), tracking_value_ids=tracking_value_ids)
                move_ids += self.env['account.move'].search([('asset_id', '=', asset.id), ('state', '=', 'draft')]).ids

        return move_ids

    @api.multi
    def set_to_close(self, disposal_date):
        move_ids = self.with_context(allow_write=True)._get_disposal_moves(disposal_date)
        self.write({'state': 'close', 'disposal_date': disposal_date})
        if move_ids:
            return self._return_disposal_view(move_ids)

    @api.multi
    def set_to_draft(self):
        self.write({'state': 'draft'})

    def resume_after_pause(self):
        """ Sets an asset in 'paused' state back to 'open'.
        A Depreciation line is created automatically to remove  from the
        depreciation amount the proportion of time spent
        in pause in the current period.
        """
        self.ensure_one()
        return self.with_context(resume_after_pause=True).action_asset_modify()

    @api.multi
    def pause(self, pause_date):
        """ Sets an 'open' asset in 'paused' state, generating first a depreciation
        line corresponding to the ratio of time spent within the current depreciation
        period before putting the asset in pause. This line and all the previous
        unposted ones are then posted.
        """
        self.ensure_one()

        all_lines_before_pause = self.depreciation_move_ids.filtered(lambda x: x.date <= pause_date)
        line_before_pause = all_lines_before_pause and max(all_lines_before_pause, key=lambda x: x.date)
        following_lines = self.depreciation_move_ids.filtered(lambda x: x.date > pause_date)
        if following_lines:
            if any(line.state == 'posted' for line in following_lines):
                raise UserError(_("You cannot pause an asset with posted depreciation lines in the future."))

            if self.prorata:
                first_following = min(following_lines, key=lambda x: x.date)
                depreciation_period_start = line_before_pause and line_before_pause.date or self.prorata_date or self.first_depreciation_date
                try:
                    time_ratio = ((pause_date - depreciation_period_start).days) / (first_following.date - depreciation_period_start).days
                    new_line = self._insert_depreciation_line(line_before_pause, first_following.amount * time_ratio, _("Asset paused"), pause_date)
                    if pause_date <= fields.Date.today():
                        new_line.post()
                except ZeroDivisionError:
                    pass

            self.write({'state': 'paused'})
            self.depreciation_move_ids.filtered(lambda x: x.state == 'draft').unlink()
            self.message_post(body=_("Asset paused"))
        else:
            raise UserError(_("Trying to pause an asset without any future depreciation line"))

    def _insert_depreciation_line(self, line_before, amount, label, depreciation_date):
        """ Inserts a new line in the depreciation board, shifting the sequence of
        all the following lines from one unit.
        :param line_before:     The depreciation line after which to insert the new line,
                                or none if the inserted line should take the first position.
        :param amount:          The depreciation amount of the new line.
        :param label:           The name to give to the new line.
        :param date:            The date to give to the new line.
        """
        self.ensure_one()
        moveObj = self.env['account.move']

        new_line = moveObj.create(moveObj._prepare_move_for_asset_depreciation({
          'amount': amount,
          'asset_id': self,
          'move_ref': self.name + ': ' + label,
          'date': depreciation_date,
          'asset_remaining_value': self.value_residual - amount,
          'asset_depreciated_value': line_before and (line_before.asset_depreciated_value + amount) or amount,
        }))
        return new_line

    @api.depends('value', 'salvage_value', 'depreciation_move_ids.state', 'depreciation_move_ids.amount')
    def _amount_residual(self):
        for asset in self:
            total_amount = sum(asset.depreciation_move_ids.filtered(lambda x: x.state == 'posted').mapped('amount'))
            asset.value_residual = asset.value - total_amount - asset.salvage_value

    @api.onchange('company_id')
    def _onchange_company_id(self):
        self.currency_id = self.company_id.currency_id.id

    @api.multi
    @api.depends('depreciation_move_ids.state')
    def _entry_count(self):
        for asset in self:
            res = self.env['account.move'].search_count([('asset_id', '=', asset.id), ('state', '=', 'posted')])
            asset.depreciation_entries_count = res or 0
            asset.total_depreciation_entries_count = len(asset.depreciation_move_ids)

    @api.multi
    def copy_data(self, default=None):
        if default is None:
            default = {}
        default['name'] = self.name + _(' (copy)')
        return super(AccountAsset, self).copy_data(default)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            original_move_line_ids = 'original_move_line_ids' in vals and self._check_original_move_line_ids(vals['original_move_line_ids'])
            if 'state' in vals and vals['state'] != 'draft' and not (set(vals) - set({'account_depreciation_id', 'account_depreciation_expense_id', 'journal_id'})):
                raise UserError(_("Some required values are missing"))
            if 'first_depreciation_date' not in vals:
                if 'date' in vals:
                    vals['first_depreciation_date'] = self._get_first_depreciation_date(vals)
                elif original_move_line_ids and 'date' in original_move_line_ids[0]:
                    vals['first_depreciation_date'] = self._get_first_depreciation_date(original_move_line_ids[0])
                else:
                    vals['first_depreciation_date'] = self._get_first_depreciation_date()
        with self.env.norecompute():
            new_recs = super(AccountAsset, self.with_context(mail_create_nolog=True)).create(vals_list)
        new_recs.filtered(lambda r: r.state != 'model')._set_value()
        new_recs.filtered(lambda r: r.state != 'model')._amount_residual()
        if self.env.context.get('original_asset'):
            # When original_asset is set, only one asset is created since its from the form view
            original_asset = self.env['account.asset'].browse(self.env.context.get('original_asset'))
            original_asset.model_id = new_recs
        return new_recs

    @api.multi
    def write(self, vals):
        'original_move_line_ids' in vals and self._check_original_move_line_ids(vals['original_move_line_ids'])
        res = super(AccountAsset, self).write(vals)
        return res

    @api.multi
    @api.constrains('depreciation_move_ids')
    def _check_depreciations(self):
        for record in self:
            if record.state == 'open' and record.depreciation_move_ids and not record.currency_id.is_zero(record.depreciation_move_ids.sorted(lambda x: x.date)[-1].asset_remaining_value):
                raise UserError(_("The remaining value on the last depreciation line must be 0"))

    def _check_original_move_line_ids(self, original_move_line_ids):
        original_move_line_ids = self.resolve_2many_commands('original_move_line_ids', original_move_line_ids) or []
        if any(line['asset_id'] for line in original_move_line_ids):
            raise UserError(_("One of the selected Journal Items already has a depreciation associated"))
        return original_move_line_ids
