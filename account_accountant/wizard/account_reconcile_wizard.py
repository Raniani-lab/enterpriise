from datetime import timedelta
from odoo import api, Command, fields, models, _
from odoo.exceptions import UserError
from odoo.tools import groupby
from odoo.tools.misc import formatLang


class AccountReconcileWizard(models.TransientModel):
    """ This wizard is used to reconcile selected account.move.line. """
    _name = 'account.reconcile.wizard'
    _description = 'Account reconciliation wizard'
    _check_company_auto = True

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        if 'move_line_ids' not in fields_list:
            return res
        if self.env.context.get('active_model') != 'account.move.line' or not self.env.context.get('active_ids'):
            raise UserError(_('This can only be used on journal items'))
        move_line_ids = self.env['account.move.line'].browse(self.env.context['active_ids'])
        accounts = move_line_ids.account_id
        if len(accounts) > 2:
            raise UserError(_(
                'You can only reconcile entries with up to two different accounts: %s',
                ', '.join(accounts.mapped('display_name')),
            ))
        shadowed_aml_values = None
        if len(accounts) == 2:
            shadowed_aml_values = {
                aml: {'account_id': move_line_ids[0].account_id}
                for aml in move_line_ids.filtered(lambda line: line.account_id != move_line_ids[0].account_id)
            }
        move_line_ids._check_amls_exigibility_for_reconciliation(shadowed_aml_values=shadowed_aml_values)
        res['move_line_ids'] = [Command.set(move_line_ids.ids)]
        return res

    company_id = fields.Many2one(comodel_name='res.company', required=True, readonly=True, compute='_compute_company_id')
    move_line_ids = fields.Many2many(
        comodel_name='account.move.line',
        string='Move lines to reconcile',
        required=True)
    reco_account_id = fields.Many2one(
        comodel_name='account.account',
        string='Reconcile Account',
        compute='_compute_reco_account_id')
    amount = fields.Monetary(
        string='Amount in company currency',
        currency_field='company_currency_id',
        compute='_compute_write_off_amounts')
    company_currency_id = fields.Many2one(comodel_name='res.currency', string='Company currency', related='company_id.currency_id')
    amount_currency = fields.Monetary(
        string='Amount',
        currency_field='reco_currency_id',
        compute='_compute_write_off_amounts')
    reco_currency_id = fields.Many2one(
        comodel_name='res.currency',
        string='Currency to use for reconciliation',
        compute='_compute_reco_currency_id')
    single_currency_mode = fields.Boolean(compute='_compute_single_currency_mode')
    allow_partials = fields.Boolean(string="Allow partials", default=False)
    date = fields.Date(string='Date', compute='_compute_date', store=True, readonly=False)
    journal_id = fields.Many2one(
        comodel_name='account.journal',
        string='Journal',
        check_company=True,
        domain="[('type', '=', 'general'), ('company_id', '=', company_id)]",
        compute='_compute_journal_id',
        store=True,
        readonly=False,
        required=True,
        precompute=True)
    account_id = fields.Many2one(
        comodel_name='account.account',
        string='Account',
        check_company=True,
        domain="[('deprecated', '=', False), ('company_id', '=', company_id)], ('internal_group', '!=', 'off_balance')")
    label = fields.Char(string='Label', default='Write-Off')
    tax_id = fields.Many2one(
        comodel_name='account.tax',
        string='Tax',
        default=False,
        check_company=True)
    to_check = fields.Boolean(
        string='To Check',
        default=False,
        help='Check if you are not certain of all the information of the counterpart.')
    is_write_off_required = fields.Boolean(
        string='Is a write-off move required to reconcile',
        compute='_compute_is_write_off_required')
    is_transfer_required = fields.Boolean(
        string='Is an account transfer required',
        compute='_compute_transfer_data')
    transfer_warning_message = fields.Char(
        string='Is an account transfer required to reconcile',
        compute='_compute_transfer_data')
    transfer_from_account_id = fields.Many2one(
        comodel_name='account.account',
        string='Account Transfer From',
        compute='_compute_transfer_data')
    transfer_amount = fields.Monetary(
        string='Amount in company currency to transfer',
        currency_field='reco_currency_id',
        compute='_compute_transfer_data')
    transfer_amount_currency = fields.Monetary(
        string='Amount in currency to transfer',
        currency_field='reco_currency_id',
        compute='_compute_transfer_data')
    lock_date_violated_warning_message = fields.Char(
        string='Is the date violating the lock date of moves',
        compute='_compute_lock_date_violated_warning_message')
    reco_model_id = fields.Many2one(
        comodel_name='account.reconcile.model',
        string='Reconciliation model',
        store=False,
        check_company=True)
    reco_model_autocomplete_ids = fields.Many2many(
        comodel_name='account.reconcile.model',
        string='All reconciliation models',
        compute='_compute_reco_model_autocomplete_ids')

    # ==== Compute methods ====
    @api.depends('move_line_ids.company_id')
    def _compute_company_id(self):
        for wizard in self:
            wizard.company_id = wizard.move_line_ids[0].company_id

    @api.depends('move_line_ids.account_id', 'is_transfer_required')
    def _compute_reco_account_id(self):
        for wizard in self:
            accounts = wizard.move_line_ids.account_id
            if wizard.is_transfer_required:
                accounts -= wizard.transfer_from_account_id
            wizard.reco_account_id = accounts

    @api.depends('is_transfer_required', 'date')
    def _compute_write_off_amounts(self):
        for wizard in self:
            AccountMoveLine = self.env['account.move.line']
            shadowed_aml_values = {
                aml: {'account_id': wizard.reco_account_id}
                for aml in wizard.move_line_ids._origin
                if wizard.is_transfer_required and aml.account_id == wizard.transfer_from_account_id
            }
            # Batch the amls all together to know what should be reconciled and when.
            plan_list, all_amls = AccountMoveLine._optimize_reconciliation_plan([wizard.move_line_ids._origin], shadowed_aml_values=shadowed_aml_values)

            # Prefetch data
            all_amls.move_id
            all_amls.matched_debit_ids
            all_amls.matched_credit_ids

            # All residual amounts are collected and updated until the creation of partials in batch.
            # This is done that way to minimize the orm time for fields invalidation/mark as recompute and
            # recomputation.
            aml_values_map = {
                aml: {
                    'aml': aml,
                    'amount_residual': aml.amount_residual,
                    'amount_residual_currency': aml.amount_residual_currency,
                }
                for aml in all_amls
            }

            disable_partial_exchange_diff = bool(self.env['ir.config_parameter'].sudo().get_param('account.disable_partial_exchange_diff'))
            plan = plan_list[0]
            # residuals are substracted from aml_values_map
            AccountMoveLine.with_context(no_exchange_difference=self._context.get('no_exchange_difference') or disable_partial_exchange_diff) \
                ._prepare_reconciliation_plan(plan, aml_values_map, shadowed_aml_values=shadowed_aml_values)

            amls_with_residual = self.env['account.move.line']
            for aml, values in aml_values_map.items():
                is_fully_reconciled = aml.currency_id.is_zero(values['amount_residual_currency']) \
                                      and aml.company_currency_id.is_zero(values['amount_residual'])
                if not is_fully_reconciled:
                    amls_with_residual |= aml

            residual_amount = 0.0
            residual_amount_currency = 0.0
            for aml in amls_with_residual:
                aml_values = aml_values_map[aml]
                available_residual_amounts = AccountMoveLine._prepare_move_line_residual_amounts(aml_values, wizard.reco_currency_id, shadowed_aml_values=shadowed_aml_values)
                residual_amount += available_residual_amounts[wizard.company_currency_id]['residual']
                residual_amount_currency += available_residual_amounts[wizard.reco_currency_id]['residual']

            most_recent_line = max(wizard.move_line_ids, key=lambda aml: aml.date)
            if most_recent_line.currency_id == wizard.reco_currency_id:
                rate = abs(most_recent_line.amount_currency / most_recent_line.balance) if most_recent_line.balance else 1.0
            else:
                rate = wizard.reco_currency_id._get_conversion_rate(wizard.company_currency_id, wizard.reco_currency_id, wizard.company_id, most_recent_line.date)

            wizard.amount = wizard.company_currency_id.round(residual_amount_currency / rate)
            wizard.amount_currency = residual_amount_currency

    @api.depends('move_line_ids.currency_id', 'company_currency_id')
    def _compute_reco_currency_id(self):
        """ Compute the currency to use for the reconciliation:
        - if only one foreign currency is present in move lines we use it,
        - if no foreign currency or more than 1 are used we use the company's default currency.
        """
        for wizard in self:
            currencies = wizard.move_line_ids.currency_id - wizard.company_currency_id
            wizard.reco_currency_id = currencies if len(currencies) == 1 else wizard.company_currency_id

    @api.depends('reco_currency_id', 'company_currency_id')
    def _compute_single_currency_mode(self):
        for wizard in self:
            wizard.single_currency_mode = wizard.reco_currency_id == wizard.company_currency_id

    @api.depends('move_line_ids', 'journal_id', 'tax_id')
    def _compute_date(self):
        for wizard in self:
            highest_date = max(aml.date for aml in wizard.move_line_ids)
            temp_move = self.env['account.move'].new({'journal_id': wizard.journal_id.id})
            wizard.date = temp_move._get_accounting_date(highest_date, bool(wizard.tax_id))

    @api.depends('company_id')
    def _compute_journal_id(self):
        for wizard in self:
            wizard.journal_id = self.env['account.journal']\
                .search([('company_id', '=', wizard.company_id.id), ('type', '=', 'general')], limit=1)

    @api.depends('amount', 'amount_currency')
    def _compute_is_write_off_required(self):
        """ We need a write-off if the balance is not 0 and if we don't allow partial reconciliation."""
        for wizard in self:
            wizard.is_write_off_required = not wizard.company_currency_id.is_zero(wizard.amount) \
                                                or not wizard.reco_currency_id.is_zero(wizard.amount_currency)

    @api.depends('move_line_ids.account_id', 'reco_currency_id')
    def _compute_transfer_data(self):
        """ We need a transfer if there are two different accounts used in move lines. """
        for wizard in self:
            accounts = wizard.move_line_ids.account_id
            wizard.is_transfer_required = len(accounts) == 2
            transfer_warning_message = False
            transfer_from_account = None
            transfer_amount = 0.0
            transfer_amount_currency = 0.0
            if wizard.is_transfer_required:
                amounts_per_account = {
                    # [reco_currency, company_currency]
                    accounts[0]: [0.0, 0.0],
                    accounts[1]: [0.0, 0.0],
                }
                for line in wizard.move_line_ids:
                    if line.currency_id == wizard.reco_currency_id:
                        amounts_per_account[line.account_id][0] += line.amount_residual_currency
                    else:
                        amounts_per_account[line.account_id][0] += line.amount_residual
                    amounts_per_account[line.account_id][1] += line.amount_residual
                if abs(amounts_per_account[accounts[0]][1]) < abs(amounts_per_account[accounts[1]][1]):
                    transfer_from_account = accounts[0]
                    transfer_to_account = accounts[1]
                    transfer_amount_currency = amounts_per_account[accounts[0]][0]
                else:
                    transfer_from_account = accounts[1]
                    transfer_to_account = accounts[0]
                    transfer_amount_currency = amounts_per_account[accounts[1]][0]
                transfer_amount = amounts_per_account[transfer_from_account][1]
                amount_formatted = formatLang(self.env, abs(transfer_amount_currency), currency_obj=wizard.reco_currency_id)
                transfer_warning_message = _(
                    'An entry will transfer %(amount)s from %(from_account)s to %(to_account)s.',
                    amount=amount_formatted,
                    from_account=transfer_from_account.display_name if transfer_amount_currency < 0 else transfer_to_account.display_name,
                    to_account=transfer_to_account.display_name if transfer_amount_currency < 0 else transfer_from_account.display_name,
                )
            wizard.transfer_warning_message = transfer_warning_message
            wizard.transfer_from_account_id = transfer_from_account
            wizard.transfer_amount = transfer_amount
            wizard.transfer_amount_currency = transfer_amount_currency

    @api.depends('move_line_ids.move_id', 'date')
    def _compute_lock_date_violated_warning_message(self):
        for wizard in self:
            date_after_lock = wizard._get_date_after_lock_date()
            lock_date_violated_warning_message = None
            if date_after_lock:
                lock_date_violated_warning_message = _(
                    'The date you set violates the lock date of one of your entry. It will be overriden by the following date : %(replacement_date)s',
                    replacement_date=date_after_lock
                )
            wizard.lock_date_violated_warning_message = lock_date_violated_warning_message

    @api.depends('company_id')
    def _compute_reco_model_autocomplete_ids(self):
        """ Computes available reconcile models, we only take models that are of type 'writeoff_button'
        and that have one (and only one) line.
        """
        for wizard in self:
            domain = [
                ('rule_type', '=', 'writeoff_button'),
                ('company_id', '=', wizard.company_id.id),
            ]
            query = self.env['account.reconcile.model']._where_calc(domain)
            tables, where_clause, where_params = query.get_sql()
            query_str = f"""
                SELECT account_reconcile_model.id
                FROM {tables}
                JOIN account_reconcile_model_line line ON line.model_id = account_reconcile_model.id
                WHERE {where_clause}
                GROUP BY account_reconcile_model.id
                HAVING COUNT(account_reconcile_model.id) = 1
            """
            self._cr.execute(query_str, where_params)
            reco_model_ids = [r[0] for r in self._cr.fetchall()]
            wizard.reco_model_autocomplete_ids = self.env['account.reconcile.model'].browse(reco_model_ids)

    # ==== Onchange methods ====
    @api.onchange('reco_model_id')
    def _onchange_reco_model_id(self):
        """ We prefill the write-off data with the reconcile model selected. """
        if self.reco_model_id:
            self.to_check = self.reco_model_id.to_check
            self.label = self.reco_model_id.line_ids.label
            self.tax_id = self.reco_model_id.line_ids.tax_ids[0] if self.reco_model_id.line_ids[0].tax_ids else None
            self.journal_id = self.reco_model_id.line_ids.journal_id  # we limited models to those with one and only one line
            self.account_id = self.reco_model_id.line_ids.account_id

    # ==== Actions methods ====
    def _action_open_wizard(self):
        self.ensure_one()
        return {
            'name': _('Write-Off Entry'),
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'account.reconcile.wizard',
            'target': 'new',
        }

    # ==== Business methods ====

    def _get_date_after_lock_date(self):
        self.ensure_one()
        lock_dates = self.company_id._get_violated_lock_dates(self.date, bool(self.tax_id))
        if lock_dates:
            return lock_dates[-1][0] + timedelta(days=1)

    def _compute_write_off_taxes_data(self, partner_id):
        """ Computes the data needed to fill the write-off lines related to taxes.
        :return: a dict of the form {
            'base_amount': 100.0,
            'base_amount_currency': 200.0,
            'tax_lines_data': [{
                'tax_amount': 21.0,
                'tax_amount_currency': 42.0,
                'tax_tag_ids': [tax_tags],
                'tax_account_id': id_of_account,
                } * nr of repartition lines of the self.tax_id ],
        }
        """
        rate = abs(self.amount_currency / self.amount)
        tax_type = self.tax_id.type_tax_use if self.tax_id else None
        is_refund = (tax_type == 'sale' and self.amount_currency > 0.0) or (tax_type == 'purchase' and self.amount_currency < 0.0)
        tax_data = self.env['account.tax']._convert_to_tax_base_line_dict(
            self,
            partner=partner_id,
            currency=self.reco_currency_id,
            taxes=self.tax_id,
            price_unit=self.amount_currency,
            quantity=1.0,
            account=self.account_id,
            is_refund=is_refund,
            rate=rate,
            handle_price_include=True,
            extra_context={'force_price_include': True},
        )
        tax_results = self.env['account.tax']._compute_taxes(
            [tax_data],
            include_caba_tags=True,
        )

        _tax_data, base_to_update = tax_results['base_lines_to_update'][0]  # we can only have one baseline
        tax_lines_data = []
        for tax_line_vals in tax_results['tax_lines_to_add']:
            tax_lines_data.append({
                'tax_amount': tax_line_vals['tax_amount'],
                'tax_amount_currency': tax_line_vals['tax_amount_currency'],
                'tax_tag_ids': tax_line_vals['tax_tag_ids'],
                'tax_account_id': tax_line_vals['account_id'],
            })
        base_amount_currency = base_to_update['price_subtotal']
        base_amount = self.amount - sum(entry['tax_amount'] for entry in tax_lines_data)

        return {
            'base_amount': base_amount,
            'base_amount_currency': base_amount_currency,
            'base_tax_tag_ids': base_to_update['tax_tag_ids'],
            'tax_lines_data': tax_lines_data,
        }

    def _create_write_off_lines(self, partner=None):
        tax_data = self._compute_write_off_taxes_data(partner) if self.tax_id else None
        partner_id = partner.id if partner else None
        line_ids_commands = [
            Command.create({
                'name': _('Write-Off'),
                'account_id': self.reco_account_id.id,
                'partner_id': partner_id,
                'currency_id': self.reco_currency_id.id,
                'amount_currency': -self.amount_currency,
                'balance': -self.amount,
            }),
            Command.create({
                'name': self.label,
                'account_id': self.account_id.id,
                'partner_id': partner_id,
                'currency_id': self.reco_currency_id.id,
                'tax_tag_ids': None if not tax_data else tax_data['base_tax_tag_ids'],
                'amount_currency': self.amount_currency if not tax_data else tax_data['base_amount_currency'],
                'balance': self.amount if not tax_data else tax_data['base_amount'],
            }),
        ]
        # Add taxes lines to the write-off lines, one per repartition line
        if tax_data:
            for tax_datum in tax_data['tax_lines_data']:
                line_ids_commands.append(Command.create({
                    'name': self.tax_id.name,
                    'account_id': tax_datum['tax_account_id'],
                    'partner_id': partner_id,
                    'currency_id': self.reco_currency_id.id,
                    'tax_tag_ids': tax_datum['tax_tag_ids'],
                    'amount_currency': tax_datum['tax_amount_currency'],
                    'balance': tax_datum['tax_amount'],
                }))
        return line_ids_commands

    def create_write_off(self):
        """ Create write-off move lines with the data provided in the wizard. """
        self.ensure_one()
        partners = self.move_line_ids.partner_id
        partner = partners if len(partners) == 1 else None
        write_off_vals = {
            'journal_id': self.journal_id.id,
            'date': self._get_date_after_lock_date() or self.date,
            'to_check': self.to_check,
            'line_ids': self._create_write_off_lines(partner=partner)
        }
        write_off_move = self.env['account.move'].create(write_off_vals)
        write_off_move.action_post()
        return write_off_move

    def create_transfer(self):
        """ Create transfer move.
        We transfer lines squashed by partner and by currency to keep the partner ledger correct.
        """
        self.ensure_one()
        # we create one transfer per partner to keep
        line_ids = []
        lines_to_transfer = self.move_line_ids.filtered(lambda line: line.account_id == self.transfer_from_account_id)
        for (partner, currency), lines_to_transfer_partner in groupby(lines_to_transfer, lambda l: (l.partner_id, l.currency_id)):
            amount = sum(line.amount_residual for line in lines_to_transfer_partner)
            amount_currency = sum(line.amount_residual_currency for line in lines_to_transfer_partner)
            line_ids += [
                Command.create({
                    'name': _('Transfer from %s', self.transfer_from_account_id.display_name),
                    'account_id': self.reco_account_id.id,
                    'partner_id': partner.id,
                    'currency_id': currency.id,
                    'amount_currency': amount_currency,
                    'balance': amount,
                }),
                Command.create({
                    'name': _('Transfer to %s', self.reco_account_id.display_name),
                    'account_id': self.transfer_from_account_id.id,
                    'partner_id': partner.id,
                    'currency_id': currency.id,
                    'amount_currency': -amount_currency,
                    'balance': -amount,
                }),
            ]
        transfer_vals = {
            'journal_id': self.journal_id.id,
            'date': self._get_date_after_lock_date() or self.date,
            'line_ids': line_ids,
        }
        transfer_move = self.env['account.move'].create(transfer_vals)
        transfer_move.action_post()
        return transfer_move

    def reconcile(self):
        """ Reconcile selected moves, with a transfer and/or write-off move if necessary."""
        self.ensure_one()
        move_lines_to_reconcile = self.move_line_ids._origin
        do_transfer = self.is_transfer_required
        do_write_off = not self.allow_partials and self.is_write_off_required
        if do_transfer:
            transfer_move = self.create_transfer()
            lines_to_transfer = move_lines_to_reconcile \
                .filtered(lambda line: line.account_id == self.transfer_from_account_id)
            transfer_line_from = transfer_move.line_ids \
                .filtered(lambda line: line.account_id == self.transfer_from_account_id)
            transfer_line_to = transfer_move.line_ids \
                .filtered(lambda line: line.account_id == self.reco_account_id)
            (lines_to_transfer + transfer_line_from).reconcile()
            move_lines_to_reconcile = move_lines_to_reconcile - lines_to_transfer + transfer_line_to

        if do_write_off:
            write_off_move = self.create_write_off()
            write_off_line_to_reconcile = write_off_move.line_ids.filtered(lambda line: line.account_id == self.reco_account_id)
            move_lines_to_reconcile += write_off_line_to_reconcile
            amls_plan = [[move_lines_to_reconcile, write_off_line_to_reconcile]]
        else:
            amls_plan = [move_lines_to_reconcile]

        self.env['account.move.line']._reconcile_plan(amls_plan)
        return move_lines_to_reconcile if not do_transfer else (move_lines_to_reconcile + transfer_move.line_ids)

    def reconcile_open(self):
        """ Reconcile selected move lines and open them in dedicated view. """
        self.ensure_one()
        return self.reconcile().open_reconcile_view()