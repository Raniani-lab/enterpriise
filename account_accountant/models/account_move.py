# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from contextlib import contextmanager
import logging
import re

from odoo import fields, models, api, _
from odoo.exceptions import UserError
from odoo.osv import expression

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _inherit = "account.move"

    # Technical field to keep the value of payment_state when switching from invoicing to accounting
    # (using invoicing_switch_threshold setting field). It allows keeping the former payment state, so that
    # we can restore it if the user misconfigured the switch date and wants to change it.
    payment_state_before_switch = fields.Char(string="Payment State Before Switch", copy=False)

    @api.model
    def _get_invoice_in_payment_state(self):
        # OVERRIDE to enable the 'in_payment' state on invoices.
        return 'in_payment'

    def action_post(self):
        # EXTENDS 'account' to trigger the CRON auto-reconciling the statement lines.
        res = super().action_post()
        if self.statement_line_id and not self._context.get('skip_statement_line_cron_trigger'):
            self.env.ref('account_accountant.auto_reconcile_bank_statement_line')._trigger()
        return res

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

    def _compute_attachment(self):
        for record in self:
            record.move_attachment_ids = self.env['ir.attachment'].search(expression.OR(record._get_attachment_domains()))

    def action_reconcile(self):
        """ This function is called by the 'Reconcile' action of account.move.line's
        tree view. It performs reconciliation between the selected lines, or, if they
        only consist of payable and receivable lines for the same partner, it opens
        the transfer wizard, pre-filled with the necessary data to transfer
        the payable/receivable open balance into the receivable/payable's one.
        This way, we can simulate reconciliation between receivable and payable
        accounts, using an intermediate account.move doing the transfer.
        """
        all_accounts = self.mapped('account_id')
        account_types = all_accounts.mapped('account_type')
        all_partners = self.mapped('partner_id')

        if len(all_accounts) == 2 and 'liability_payable' in account_types and 'asset_receivable' in account_types:

            if len(all_partners) != 1:
                raise UserError(_("You cannot reconcile the payable and receivable accounts of multiple partners together at the same time."))

            # In case we have only lines for one (or no) partner and they all
            # are located on a single receivable or payable account,
            # we can simulate reconciliation between them with a transfer entry.
            # So, we open the wizard allowing to do that, pre-filling the values.

            max_total = 0
            max_account = None
            for account in all_accounts:
                account_total = abs(sum(line.balance for line in self.filtered(lambda x: x.account_id == account)))
                if not max_account or max_total < account_total:
                    max_account = account
                    max_total = account_total

            wizard = self.env['account.automatic.entry.wizard'].create({
                'move_line_ids': [(6, 0, self.ids)],
                'destination_account_id': max_account.id,
                'action': 'change_account',
            })

            return {
                'name': _("Transfer Accounts"),
                'type': 'ir.actions.act_window',
                'view_type': 'form',
                'view_mode': 'form',
                'res_model': 'account.automatic.entry.wizard',
                'res_id': wizard.id,
                'target': 'new',
                'context': {'active_ids': self.ids, 'active_model': 'account.move.line'},
            }

        return {
            'type': 'ir.actions.client',
            'name': _('Reconcile'),
            'tag': 'manual_reconciliation_view',
            'binding_model_id': self.env['ir.model.data']._xmlid_to_res_id('account.model_account_move_line'),
            'binding_type': 'action',
            'binding_view_types': 'list',
            'context': {'active_ids': self.ids, 'active_model': 'account.move.line'},
        }

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
