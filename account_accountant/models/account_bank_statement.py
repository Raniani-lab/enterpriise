from odoo import _, api, fields, models
from odoo.addons.base.models.res_bank import sanitize_account_number
from odoo.osv.expression import get_unaccent_wrapper
from odoo.tools import html2plaintext

from dateutil.relativedelta import relativedelta


class AccountBankStatement(models.Model):
    _inherit = 'account.bank.statement'

    def action_open_bank_reconcile_widget(self):
        self.ensure_one()
        return self.env['account.bank.statement.line']._action_open_bank_reconciliation_widget(
            name=self.name,
            default_context={
                'default_statement_id': self.id,
                'default_journal_id': self.journal_id.id,
            },
            extra_domain=[('statement_id', '=', self.id)]
        )


class AccountBankStatementLine(models.Model):
    _inherit = 'account.bank.statement.line'

    # Technical field holding the date of the last time the cron tried to auto-reconcile the statement line. Used to
    # optimize the bank matching process"
    cron_last_check = fields.Datetime()

    def action_save_close(self):
        return {'type': 'ir.actions.act_window_close'}

    def action_save_new(self):
        action = self.env['ir.actions.act_window']._for_xml_id('account_accountant.action_bank_statement_line_form_bank_rec_widget')
        action['context'] = {'default_journal_id': self._context['default_journal_id']}
        return action

    ####################################################
    # RECONCILIATION PROCESS
    ####################################################

    @api.model
    def _action_open_bank_reconciliation_widget(self, extra_domain=None, default_context=None, name=None):
        context = default_context or {}
        return {
            'name': name or _("Bank Reconciliation"),
            'type': 'ir.actions.act_window',
            'res_model': 'account.bank.statement.line',
            'context': context,
            'search_view_id': [self.env.ref('account_accountant.view_bank_statement_line_search_bank_rec_widget').id, 'search'],
            'view_mode': 'kanban,list',
            'views': [
                (self.env.ref('account_accountant.view_bank_statement_line_kanban_bank_rec_widget').id, 'kanban'),
                (self.env.ref('account_accountant.view_bank_statement_line_tree_bank_rec_widget').id, 'list'),
            ],
            'domain': [('state', '!=', 'cancel')] + (extra_domain or []),
        }

    def action_open_recon_st_line(self):
        self.ensure_one()
        return self.env['account.bank.statement.line']._action_open_bank_reconciliation_widget(
            name=self.name,
            default_context={
                'default_statement_id': self.statement_id.id,
                'default_journal_id': self.journal_id.id,
                'default_st_line_id': self.id,
                'search_default_id': self.id,
            },
        )

    @api.model
    def _cron_try_auto_reconcile_statement_lines(self, batch_size=None):
        """ Method called by the CRON to reconcile the statement lines automatically.

        :param batch_size:  The maximum number of statement lines that could be processed at once by the CRON to avoid
                            a timeout. If specified, the CRON will be trigger again asap using a CRON trigger in case
                            there is still some statement lines to process.
        """
        self.env['account.reconcile.model'].flush_model()

        # Check the companies having at least one reconcile model using the 'auto_reconcile' feature.
        query_obj = self.env['account.reconcile.model']._search([
            ('auto_reconcile', '=', True),
            ('rule_type', 'in', ('writeoff_suggestion', 'invoice_matching')),
        ])
        query_obj.order = 'company_id'
        query_str, query_params = query_obj.select('DISTINCT company_id')
        self._cr.execute(query_str, query_params)
        configured_company_ids = [r[0] for r in self._cr.fetchall()]
        if not configured_company_ids:
            return

        # Find the bank statement lines that are not reconciled and try to reconcile them automatically.
        # The ones that are never be processed by the CRON before are processed first.
        limit = batch_size + 1 if batch_size else None
        has_more_st_lines_to_reconcile = False
        datetime_now = fields.Datetime.now()
        companies = self.env['res.company'].browse(configured_company_ids)
        lock_dates = companies.filtered('fiscalyear_lock_date').mapped('fiscalyear_lock_date')
        st_date_from_limit = max([datetime_now.date() - relativedelta(months=3)] + lock_dates)

        self.env['account.bank.statement.line'].flush_model()
        domain = [
            ('is_reconciled', '=', False),
            ('date', '>', st_date_from_limit),
            ('company_id', 'in', configured_company_ids),
        ]
        query_obj = self._search(domain, order='cron_last_check DESC, id', limit=limit)
        query_str, query_params = query_obj.select('account_bank_statement_line.id')
        self._cr.execute(query_str, query_params)
        st_line_ids = [r[0] for r in self._cr.fetchall()]
        if batch_size and len(st_line_ids) > batch_size:
            st_line_ids = st_line_ids[:batch_size]
            has_more_st_lines_to_reconcile = True

        st_lines = self.env['account.bank.statement.line'].browse(st_line_ids)
        nb_auto_reconciled_lines = 0
        for st_line in st_lines:
            wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=st_line.id).new({})
            wizard._action_trigger_matching_rules()
            if wizard.state == 'valid' and wizard.matching_rules_allow_auto_reconcile:
                wizard.button_validate(async_action=False)

                st_line.move_id.message_post(body=_(
                    "This bank transaction has been automatically validated using the reconciliation model '%s'.",
                    ', '.join(st_line.move_id.line_ids.reconcile_model_id.mapped('name')),
                ))

                nb_auto_reconciled_lines += 1
        st_lines.write({'cron_last_check': datetime_now})

        # The configuration seems effective since some lines has been automatically reconciled right now and there is
        # some statement lines left.
        if nb_auto_reconciled_lines and has_more_st_lines_to_reconcile:
            self.env.ref('account_accountant.auto_reconcile_bank_statement_line')._trigger()

    def _retrieve_partner(self):
        self.ensure_one()

        # Retrieve the partner from the statement line.
        if self.partner_id:
            return self.partner_id

        # Retrieve the partner from the bank account.
        if self.account_number:
            account_number_nums = sanitize_account_number(self.account_number)
            if account_number_nums:
                domain = [('sanitized_acc_number', 'ilike', account_number_nums)]
                for extra_domain in ([('company_id', '=', self.company_id.id)], []):
                    bank_accounts = self.env['res.partner.bank'].search(extra_domain + domain)
                    if len(bank_accounts.partner_id) == 1:
                        return bank_accounts.partner_id

        # Retrieve the partner from the partner name.
        if self.partner_name:
            domain = [
                ('parent_id', '=', False),
                ('name', 'ilike', self.partner_name),
            ]
            for extra_domain in ([('company_id', '=', self.company_id.id)], []):
                partner = self.env['res.partner'].search(extra_domain + domain, limit=1)
                if partner:
                    return partner

        # Retrieve the partner from the 'reconcile models'.
        rec_models = self.env['account.reconcile.model'].search([
            ('rule_type', '!=', 'writeoff_button'),
            ('company_id', '=', self.company_id.id),
        ])
        for rec_model in rec_models:
            partner = rec_model._get_partner_from_mapping(self)
            if partner and rec_model._is_applicable_for(self, partner):
                return partner

        # Retrieve the partner from statement line text values.
        st_line_text_values = self._get_st_line_strings_for_matching()
        unaccent = get_unaccent_wrapper(self._cr)
        sub_queries = []
        params = []
        for text_value in st_line_text_values:
            if not text_value:
                continue

            # Find a partner having a name contained inside the statement line values.
            # Take care a partner could contain some special characters in its name that needs to be escaped.
            sub_queries.append(rf'''
                {unaccent("%s")} ~* ('^' || (
                   SELECT STRING_AGG(CONCAT('(?=.*\m', chunk[1], '\M)'), '')
                   FROM regexp_matches({unaccent('partner.name')}, '\w{{3,}}', 'g') AS chunk
                ))
            ''')
            params.append(text_value)

        if sub_queries:
            self.env['res.partner'].flush_model(['company_id', 'name'])
            self.env['account.move.line'].flush_model(['partner_id', 'company_id'])
            self._cr.execute(
                '''
                    SELECT aml.partner_id
                    FROM account_move_line aml
                    JOIN res_partner partner ON
                        aml.partner_id = partner.id
                        AND partner.name IS NOT NULL
                        AND partner.active
                        AND ((''' + ') OR ('.join(sub_queries) + '''))
                    WHERE aml.company_id = %s
                    LIMIT 1
                ''',
                params + [self.company_id.id],
            )
            row = self._cr.fetchone()
            if row:
                return self.env['res.partner'].browse(row[0])

        return self.env['res.partner']

    def _get_st_line_strings_for_matching(self, allowed_fields=None):
        """ Collect the strings that could be used on the statement line to perform some matching.

        :param allowed_fields: A explicit list of fields to consider.
        :return: A list of strings.
        """
        self.ensure_one()

        def _get_text_value(field_name):
            if self._fields[field_name].type == 'html':
                return self[field_name] and html2plaintext(self[field_name])
            else:
                return self[field_name]

        st_line_text_values = []
        if allowed_fields is None or 'payment_ref' in allowed_fields:
            value = _get_text_value('payment_ref')
            if value:
                st_line_text_values.append(value)
        if allowed_fields is None or 'narration' in allowed_fields:
            value = _get_text_value('narration')
            if value:
                st_line_text_values.append(value)
        if allowed_fields is None or 'ref' in allowed_fields:
            value = _get_text_value('ref')
            if value:
                st_line_text_values.append(value)
        return st_line_text_values
