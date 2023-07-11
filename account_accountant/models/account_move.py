# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from contextlib import contextmanager
import calendar
import logging
import re
from dateutil.relativedelta import relativedelta

from odoo import fields, models, api, _, Command
from odoo.exceptions import UserError
from odoo.osv import expression

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _inherit = "account.move"

    # Technical field to keep the value of payment_state when switching from invoicing to accounting
    # (using invoicing_switch_threshold setting field). It allows keeping the former payment state, so that
    # we can restore it if the user misconfigured the switch date and wants to change it.
    payment_state_before_switch = fields.Char(string="Payment State Before Switch", copy=False)

    # Deferred management fields
    deferred_move_ids = fields.Many2many(
        string="Deferred Entries",
        comodel_name='account.move',
        relation='account_move_deferred_rel',
        column1='original_move_id',
        column2='deferred_move_id',
        help="The deferred entries created by this invoice",
        copy=False,
    )

    deferred_original_move_ids = fields.Many2many(
        string="Original Invoices",
        comodel_name='account.move',
        relation='account_move_deferred_rel',
        column1='deferred_move_id',
        column2='original_move_id',
        help="The original invoices that created the deferred entries",
        copy=False,
    )

    deferred_entry_type = fields.Selection(
        string="Deferred Entry Type",
        selection=[
            ('expense', 'Deferred Expense'),
            ('revenue', 'Deferred Revenue'),
        ],
        compute='_compute_deferred_entry_type',
        copy=False,
    )

    @api.model
    def _get_invoice_in_payment_state(self):
        # OVERRIDE to enable the 'in_payment' state on invoices.
        return 'in_payment'

    def _post(self, soft=True):
        # Deferred management
        posted = super()._post(soft)
        for move in self:
            if move.company_id.generate_deferred_entries_method == 'on_validation' and any(move.line_ids.mapped('deferred_start_date')):
                move._generate_deferred_entries()
        return posted

    def action_post(self):
        # EXTENDS 'account' to trigger the CRON auto-reconciling the statement lines.
        res = super().action_post()
        if self.statement_line_id and not self._context.get('skip_statement_line_cron_trigger'):
            self.env.ref('account_accountant.auto_reconcile_bank_statement_line')._trigger()
        return res

    def button_draft(self):
        self.deferred_move_ids._unlink_or_reverse()
        return super().button_draft()

    def _reverse_moves(self, default_values_list=None, cancel=False):
        reverse = super()._reverse_moves(default_values_list=default_values_list, cancel=cancel)
        if self.deferred_move_ids:
            self.deferred_move_ids._reverse_moves()
        return reverse

    # ============================= START - Deferred Management ====================================

    @api.depends('deferred_original_move_ids')
    def _compute_deferred_entry_type(self):
        for move in self:
            if move.deferred_original_move_ids:
                move.deferred_entry_type = 'expense' if move.deferred_original_move_ids[0].is_outbound() else 'revenue'
            else:
                move.deferred_entry_type = False

    @api.model
    def _get_deferred_diff_dates(self, start, end):
        """
        Returns the number of months between two dates [start, end[
        The computation is done by using months of 30 days so that the deferred amount for february
        (28-29 days), march (31 days) and april (30 days) are all the same (in case of monthly computation).
        See test_deferred_management_get_diff_dates for examples.
        """
        if start > end:
            start, end = end, start
        nb_months = end.month - start.month + 12 * (end.year - start.year)
        start_day, end_day = start.day, end.day
        if start_day == calendar.monthrange(start.year, start.month)[1]:
            start_day = 30
        if end_day == calendar.monthrange(end.year, end.month)[1]:
            end_day = 30
        nb_days = end_day - start_day
        return (nb_months * 30 + nb_days) / 30

    @api.model
    def _get_deferred_period_amount(self, method, period_start, period_end, line_start, line_end, balance):
        """
        Returns the amount to defer for the given period taking into account the deferred method (day/month).
        """
        if method == 'day':
            amount_per_day = balance / ((line_end - line_start).days + 1)  # +1 because the end date is included
            return (period_end - period_start).days * amount_per_day if period_end > line_start else 0
        else:
            amount_per_month = balance / self._get_deferred_diff_dates(line_end + relativedelta(days=1), line_start)  # +1 because the end date is included
            return self._get_deferred_diff_dates(period_end, period_start) * amount_per_month if period_end > line_start and period_end > period_start else 0

    @api.model
    def _get_deferred_amounts_by_line(self, lines, periods):
        """
        :return: a tuple containing:
            a list of dictionaries containing the deferred amounts for each line and each period
            a set of move_ids of the lines (to keep track of the original invoice in the deferred entries)
        E.g. (where period1 = (date1, date2), period2 = (date2, date3), ...)
        [
            {'account_id': 1, period_1: 100, period_2: 200},
            {'account_id': 1, period_1: 100, period_2: 200},
            {'account_id': 2, period_1: 300, period_2: 400},
        ], (1, 2, 3)
        """
        values = []
        original_move_ids = set()
        for line in lines:
            line_start = fields.Date.to_date(line['deferred_start_date'])
            line_end = fields.Date.to_date(line['deferred_end_date'])

            columns = {}
            for i, period in enumerate(periods):
                day_to_add = 0 if i in (1, len(periods) - 1) and len(periods) > 1 else 1  # +1 because the end date is included for all columns except Before and Later (or if there is only one period)
                columns[period] = self._get_deferred_period_amount(
                    self.env.company.deferred_amount_computation_method,
                    max(period[0], line_start), min(period[1], line_end) + relativedelta(days=day_to_add),
                    line_start, line_end,
                    line['balance']
                )

            values.append({
                'account_id': line['account_id'],
                'balance': line['balance'],
                **columns,
            })
            original_move_ids.add(int(line['move_id']))
        return values, tuple(original_move_ids)

    @api.model
    def _get_deferred_lines(self, line, deferred_account, period, ref):
        """
        :return: a list of Command objects to create the deferred lines of a single given period
        """
        deferred_amounts = self._get_deferred_amounts_by_line(line, [period])[0][0]
        balance = deferred_amounts[period]
        return [
            Command.create({
                'account_id': deferred_amounts['account_id'].id,
                'balance': balance,
                'name': ref,
            }),
            Command.create({
                'account_id': deferred_account.id,
                'balance': -balance,
                'name': ref,
            }),
        ]

    def _generate_deferred_entries(self):
        """
        Generates the deferred entries for the invoice.
        """
        self.ensure_one()
        if self.is_entry():
            raise UserError(_("You cannot generate deferred entries for a miscellaneous journal entry."))
        assert not self.deferred_move_ids, "The deferred entries have already been generated for this document."
        is_deferred_expense = self.is_purchase_document()
        deferred_account = self.company_id.deferred_expense_account_id if is_deferred_expense else self.company_id.deferred_revenue_account_id
        deferred_journal = self.company_id.deferred_journal_id
        if not deferred_journal:
            raise UserError(_("Please set the deferred journal in the accounting settings."))
        if not deferred_account:
            raise UserError(_("Please set the deferred accounts in the accounting settings."))

        for line in self.line_ids.filtered(lambda l: l.deferred_start_date and l.deferred_end_date):
            periods = line._get_deferred_periods()
            if not periods:
                continue

            ref = _("Deferral of %s", line.move_id.name or '')
            # Defer the current invoice
            move_fully_deferred = self.create({
                'move_type': 'entry',
                'deferred_original_move_ids': [Command.set(line.move_id.ids)],
                'journal_id': deferred_journal.id,
                'date': line.move_id.invoice_date + relativedelta(day=31),
                'auto_post': 'at_date',
                'ref': ref,
                'line_ids': [
                    Command.create({
                        'account_id': line.account_id.id,
                        'balance': -1 * line.balance,
                        'name': ref,
                    }),
                    Command.create({
                        'account_id': deferred_account.id,
                        'balance': line.balance,
                        'name': ref,
                    }),
                ],
            })
            line.move_id.deferred_move_ids |= move_fully_deferred
            move_fully_deferred._post(soft=True)

            # Create the deferred entries for the periods [deferred_start_date, deferred_end_date]
            for period in periods:
                deferred_move = self.create({
                    'move_type': 'entry',
                    'deferred_original_move_ids': [Command.set(line.move_id.ids)],
                    'journal_id': deferred_journal.id,
                    'date': period[1],
                    'auto_post': 'at_date',
                    'ref': ref,
                    'line_ids': self._get_deferred_lines(line, deferred_account, period, ref),
                })
                line.move_id.deferred_move_ids |= deferred_move
                deferred_move._post(soft=True)

    def open_deferred_entries(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _("Deferred Entries"),
            'res_model': 'account.move',
            'domain': [('id', 'in', self.deferred_move_ids.ids)],
            'views': [(self.env.ref('account.view_move_tree').id, 'tree'), (False, 'form')],
        }

    def open_deferred_original_entry(self):
        self.ensure_one()
        action = {
            'type': 'ir.actions.act_window',
            'name': _("Original Deferred Entries"),
            'res_model': 'account.move',
            'domain': [('id', 'in', self.deferred_original_move_ids.ids)],
            'views': [(self.env.ref('account.view_move_tree').id, 'tree'), (False, 'form')],
        }
        if len(self.deferred_original_move_ids) == 1:
            action.update({
                'res_id': self.deferred_original_move_ids[0].id,
                'views': [(False, 'form')],
            })
        return action

    # ============================= END - Deferred management ======================================

    def action_open_bank_reconciliation_widget(self):
        return self.statement_line_id._action_open_bank_reconciliation_widget(
            default_context={
                'search_default_journal_id': self.statement_line_id.journal_id.id,
                'search_default_statement_line_id': self.statement_line_id.id,
                'default_st_line_id': self.statement_line_id.id,
            }
        )

    def action_open_bank_reconciliation_widget_statement(self):
        return self.statement_line_id._action_open_bank_reconciliation_widget(
            extra_domain=[('statement_id', 'in', self.statement_id.ids)],
        )

    def action_open_business_doc(self):
        if self.statement_line_id:
            return self.action_open_bank_reconciliation_widget()
        else:
            return super().action_open_business_doc()

    def _get_mail_thread_data_attachments(self):
        res = super()._get_mail_thread_data_attachments()
        res += self.statement_line_id.statement_id.attachment_ids
        return res

    @contextmanager
    def _get_edi_creation(self):
        with super()._get_edi_creation() as move:
            previous_lines = move.invoice_line_ids
            yield move
            for line in move.invoice_line_ids - previous_lines:
                line._onchange_name_predictive()


class AccountMoveLine(models.Model):
    _name = "account.move.line"
    _inherit = "account.move.line"

    move_attachment_ids = fields.One2many('ir.attachment', compute='_compute_attachment')

    # Deferred management fields
    deferred_start_date = fields.Date(
        string="Start Date",
        compute='_compute_deferred_start_date', store=True, readonly=False,
        index='btree_not_null',
        copy=False,
        help="Date at which the deferred expense/revenue starts"
    )
    deferred_end_date = fields.Date(
        string="End Date",
        compute='_compute_deferred_end_date', store=True, readonly=False,
        index='btree_not_null',
        copy=False,
        help="Date at which the deferred expense/revenue ends"
    )

    def copy_data(self, default=None):
        data_list = super().copy_data(default=default)
        for line, values in zip(self, data_list):
            if 'move_reverse_cancel' in self._context:
                values['deferred_start_date'] = line.deferred_start_date
                values['deferred_end_date'] = line.deferred_end_date
        return data_list

    def _is_compatible_account(self):
        self.ensure_one()
        return (
            self.move_id.is_purchase_document()
            and
            self.account_id.account_type in ('expense', 'expense_depreciation', 'expense_direct_cost')
        ) or (
            self.move_id.is_sale_document()
            and
            self.account_id.account_type in ('income', 'income_other')
        )

    @api.depends('deferred_end_date', 'move_id.invoice_date', 'account_id.account_type', 'move_id.state')
    def _compute_deferred_start_date(self):
        for line in self:
            if not line._is_compatible_account():
                line.deferred_start_date = False
                continue
            if not line.deferred_start_date and line.move_id.invoice_date and line.deferred_end_date:
                line.deferred_start_date = line.move_id.invoice_date

    @api.depends('account_id.account_type')
    def _compute_deferred_end_date(self):
        for line in self:
            if not line._is_compatible_account():
                line.deferred_end_date = False

    @api.constrains('deferred_start_date', 'deferred_end_date', 'account_id')
    def _check_deferred_dates(self):
        for line in self:
            if line.deferred_start_date and not line.deferred_end_date:
                raise UserError(_("You cannot create a deferred entry with a start date but no end date."))
            elif line.deferred_start_date and line.deferred_end_date and line.deferred_start_date > line.deferred_end_date:
                raise UserError(_("You cannot create a deferred entry with a start date later than the end date."))

    @api.depends('deferred_start_date', 'deferred_end_date')
    def _compute_all_tax(self):
        super()._compute_all_tax()
        for line in self:
            for key in list(line.compute_all_tax.keys()):
                rep_line = self.env['account.tax.repartition.line'].browse(key.get('tax_repartition_line_id'))
                if not rep_line.use_in_tax_closing and line._is_compatible_account():
                    line.compute_all_tax[key].update({
                        'deferred_start_date': line.deferred_start_date,
                        'deferred_end_date': line.deferred_end_date,
                    })

    @api.model
    def _get_deferred_ends_of_month(self, start_date, end_date):
        """
        :return: a list of dates corresponding to the end of each month between start_date and end_date.
            See test_get_ends_of_month for examples.
        """
        dates = []
        while start_date <= end_date:
            start_date = start_date + relativedelta(day=31)  # Go to end of month
            dates.append(start_date)
            start_date = start_date + relativedelta(days=1)  # Go to first day of next month
        return dates

    def _get_deferred_periods(self):
        """
        :return: a list of tuples (start_date, end_date) during which the deferred expense/revenue is spread.
            If there is only one period, it means that we don't need to defer the expense/revenue
            since the invoice deferral and its deferred entry will be created on the same day and will
            thus cancel each other.
        """
        self.ensure_one()
        periods = [
            (max(self.deferred_start_date, date.replace(day=1)), min(date, self.deferred_end_date))
            for date in self._get_deferred_ends_of_month(self.deferred_start_date, self.deferred_end_date)
        ]
        return periods if len(periods) > 1 else []

    def _compute_attachment(self):
        for record in self:
            record.move_attachment_ids = self.env['ir.attachment'].search(expression.OR(record._get_attachment_domains()))

    def action_reconcile(self):
        """ This function is called by the 'Reconcile' button of account.move.line's
        tree view. It performs reconciliation between the selected lines.
        - If the reconciliation can be done directly we do it silently
        - Else, if a write-off is required we open the wizard to let the client enter required information
        """
        wizard = self.env['account.reconcile.wizard'].with_context(
            active_model='account.move.line',
            active_ids=self.ids,
        ).new({})
        return wizard._action_open_wizard() if wizard.is_write_off_required else wizard.reconcile()

    def _get_predict_postgres_dictionary(self):
        lang = self._context.get('lang') and self._context.get('lang')[:2]
        return {'fr': 'french'}.get(lang, 'english')

    def _build_predictive_query(self, additional_domain=None):
        move_query = self.env['account.move']._where_calc([
            ('move_type', '=', self.move_id.move_type),
            ('state', '=', 'posted'),
            ('partner_id', '=', self.move_id.partner_id.id),
            ('company_id', '=', self.move_id.journal_id.company_id.id or self.env.company.id),
        ])
        move_query.order = 'account_move.invoice_date'
        move_query.limit = int(self.env["ir.config_parameter"].sudo().get_param(
            "account.bill.predict.history.limit",
            '100',
        ))
        return self.env['account.move.line']._where_calc([
            ('move_id', 'in', move_query),
            ('display_type', '=', 'product'),
        ] + (additional_domain or []))

    def _predicted_field(self, field, query=None, additional_queries=None):
        r"""Predict the most likely value based on the previous history.

        This method uses postgres tsvector in order to try to deduce a field of
        an invoice line based on the text entered into the name (description)
        field and the partner linked.
        We only limit the search on the previous 100 entries, which according
        to our tests bore the best results. However this limit parameter is
        configurable by creating a config parameter with the key:
        account.bill.predict.history.limit

        For information, the tests were executed with a dataset of 40 000 bills
        from a live database, We split the dataset in 2, removing the 5000 most
        recent entries and we tried to use this method to guess the account of
        this validation set based on the previous entries.
        The result is roughly 90% of success.

        :param field (str): the sql column that has to be predicted.
            /!\ it is injected in the query without any checks.
        :param query (osv.Query): the query object on account.move.line that is
            used to do the ranking, containing the right domain, limit, etc. If
            it is omitted, a default query is used.
        :param additional_queries (list<str>): can be used in addition to the
            default query on account.move.line to fetch data coming from other
            tables, to have starting values for instance.
            /!\ it is injected in the query without any checks.
        """
        if not self.name or not self.partner_id:
            return False

        psql_lang = self._get_predict_postgres_dictionary()
        description = self.name + ' account_move_line' # give more priority to main query than additional queries
        parsed_description = re.sub(r"[*&()|!':<>=%/~@,.;$\[\]]+", " ", description)
        parsed_description = ' | '.join(parsed_description.split())

        from_clause, where_clause, params = (query if query is not None else self._build_predictive_query()).get_sql()
        try:
            self.env.cr.execute(f"""
                WITH source AS ({'(' + ') UNION ALL ('.join([self.env.cr.mogrify(f'''
                    SELECT {field} AS prediction,
                           setweight(to_tsvector(%%(lang)s, account_move_line.name), 'B')
                           || setweight(to_tsvector('simple', 'account_move_line'), 'A') AS document
                      FROM {from_clause}
                     WHERE {where_clause}
                  GROUP BY account_move_line.id
                ''', params).decode()] + (additional_queries or [])) + ')'}
                ),

                ranking AS (
                    SELECT prediction, ts_rank(source.document, query_plain) AS rank
                      FROM source, to_tsquery(%(lang)s, %(description)s) query_plain
                     WHERE source.document @@ query_plain
                )

                SELECT prediction, MAX(rank) AS ranking, COUNT(*)
                  FROM ranking
              GROUP BY prediction
              ORDER BY ranking DESC, count DESC
            """, {
                'lang': psql_lang,
                'description': parsed_description,
                'company_id': self.move_id.journal_id.company_id.id or self.env.company.id,
            })
            result = self.env.cr.dictfetchone()
            if result:
                return result['prediction']
        except Exception:
            # In case there is an error while parsing the to_tsquery (wrong character for example)
            # We don't want to have a blocking traceback, instead return False
            _logger.exception('Error while predicting invoice line fields')
        return False

    def _predict_taxes(self):
        field = 'array_agg(account_move_line__tax_rel__tax_ids.id ORDER BY account_move_line__tax_rel__tax_ids.id)'
        query = self._build_predictive_query()
        query.left_join('account_move_line', 'id', 'account_move_line_account_tax_rel', 'account_move_line_id', 'tax_rel')
        query.left_join('account_move_line__tax_rel', 'account_tax_id', 'account_tax', 'id', 'tax_ids')
        query.add_where('account_move_line__tax_rel__tax_ids.active IS NOT FALSE')
        return self._predicted_field(field, query)

    def _predict_product(self):
        query = self._build_predictive_query(['|', ('product_id', '=', False), ('product_id.active', '=', True)])
        return self._predicted_field('account_move_line.product_id', query)

    def _predict_account(self):
        field = 'account_move_line.account_id'
        additional_queries = ["""
                SELECT id as account_id,
                       setweight(to_tsvector(%(lang)s, name), 'B') AS document
                  FROM account_account account
                 WHERE account.deprecated IS NOT TRUE
                   AND account.internal_group  = 'expense'
                   AND company_id = %(company_id)s
        """]
        if self.move_id.is_purchase_document(True):
            excluded_group = 'income'
        else:
            excluded_group = 'expense'
        query = self._build_predictive_query([
            ('account_id.deprecated', '=', False),
            ('account_id.internal_group', '!=', excluded_group),
        ])
        return self._predicted_field(field, query, additional_queries)

    @api.onchange('name')
    def _onchange_name_predictive(self):
        if (self.move_id.quick_edit_mode or self.move_id.move_type == 'in_invoice')and self.name and self.display_type == 'product':
            predict_product = int(self.env['ir.config_parameter'].sudo().get_param('account_predictive_bills.predict_product', '1'))

            if predict_product and not self.product_id and self.company_id.predict_bill_product:
                predicted_product_id = self._predict_product()
                if predicted_product_id and predicted_product_id != self.product_id.id:
                    name = self.name
                    self.product_id = predicted_product_id
                    self.name = name

            # Product may or may not have been set above, if it has been set, account and taxes are set too
            if not self.product_id:
                # Predict account.
                predicted_account_id = self._predict_account()
                if predicted_account_id and predicted_account_id != self.account_id.id:
                    self.account_id = predicted_account_id

                if not self.tax_ids:
                    # Predict taxes
                    predicted_tax_ids = self._predict_taxes()
                    if predicted_tax_ids == [None]:
                        predicted_tax_ids = []
                    if predicted_tax_ids is not False and set(predicted_tax_ids) != set(self.tax_ids.ids):
                        self.tax_ids = self.env['account.tax'].browse(predicted_tax_ids)

    def _read_group_groupby(self, groupby_spec, query):
        """ EXTENDS 'base'
        Allows to set :abs method on fields, useful when trying to match positive and negative amounts.
        """
        if ':' in groupby_spec:
            field, method = groupby_spec.split(':')
            if field in self and method == 'abs_rounded':  # field in self avoids possible injections
                # rounds with the used currency settings
                return f'ROUND(ABS("account_move_line"."{field}"), "account_move_line__currency_id"."decimal_places")', [field]
        return super()._read_group_groupby(groupby_spec, query)

    def _read_group_having(self, having_domain, query):
        """ EXTENDS 'base'
        Allows to use HAVING clause that sum rounded values depending on the currency precision settings.
        We only handle a having clause of one element with that specific method :sum_rounded.
        """
        if having_domain and 'sum_rounded' in str(having_domain):
            left, operator, right = having_domain[0]
            if ':' in left:
                fname, func = left.split(':')
                if fname in self and func == 'sum_rounded':  # fname in self avoids possible injections
                    field_expression = self._inherits_join_calc(self._table, fname, query)
                    query.left_join('account_move_line', 'currency_id', 'res_currency', 'id', 'currency_id')
                    return f'SUM(ROUND({field_expression}, "account_move_line__currency_id"."decimal_places")) {operator} %s', [right], [fname]
        return super()._read_group_having(having_domain, query)
