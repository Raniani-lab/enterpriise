from odoo import _, api, fields, models
from odoo.addons.base.models.res_bank import sanitize_account_number
from odoo.tools import html2plaintext

from dateutil.relativedelta import relativedelta
from itertools import product
from lxml import etree

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

    def action_generate_attachment(self):
        ir_actions_report_sudo = self.env['ir.actions.report'].sudo()
        statement_report_action = self.env.ref('account.action_report_account_statement')
        for statement in self:
            statement_report = statement_report_action.sudo()
            content, _content_type = ir_actions_report_sudo._render_qweb_pdf(statement_report, res_ids=statement.ids)
            statement.attachment_ids |= self.env['ir.attachment'].create({
                'name': _("Bank Statement %s.pdf", statement.name) if statement.name else _("Bank Statement.pdf"),
                'type': 'binary',
                'mimetype': 'application/pdf',
                'raw': content,
                'res_model': statement._name,
                'res_id': statement.id,
            })
        return statement_report_action.report_action(docids=self)

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    @api.model
    def get_view(self, view_id=None, view_type='form', **options):
        # EXTENDS base
        # include field 'create_date' to avoid a module update (required to compute balance start)
        # TO BE REMOVED IN MASTER
        res = super().get_view(view_id=view_id, view_type=view_type, options=options)
        if view_type == 'form':
            form_view = self.env.ref('account_accountant.view_bank_statement_form_bank_rec_widget')
            tree = etree.fromstring(res['arch'])
            if res.get('id') == form_view.id and len(tree.xpath("//field[@name='create_date']")) == 0:
                arch_tree = etree.fromstring(form_view.arch)
                arch_tree.insert(0, etree.Element('field', attrib={
                    'name': 'create_date',
                    'invisible': '1',
                }))
                form_view.sudo().write({'arch': etree.tostring(arch_tree, encoding='unicode')})
                return super().get_view(view_id=view_id, view_type=view_type, options=options)
        return res

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
    def _action_open_bank_reconciliation_widget(self, extra_domain=None, default_context=None, name=None, kanban_first=True):
        context = default_context or {}
        views = [
            (self.env.ref('account_accountant.view_bank_statement_line_kanban_bank_rec_widget').id, 'kanban'),
            (self.env.ref('account_accountant.view_bank_statement_line_tree_bank_rec_widget').id, 'list'),
        ]
        return {
            'name': name or _("Bank Reconciliation"),
            'type': 'ir.actions.act_window',
            'res_model': 'account.bank.statement.line',
            'context': context,
            'search_view_id': [self.env.ref('account_accountant.view_bank_statement_line_search_bank_rec_widget').id, 'search'],
            'view_mode': 'kanban,list' if kanban_first else 'list,kanban',
            'views': views if kanban_first else views[::-1],
            'domain': [('state', '!=', 'cancel')] + (extra_domain or []),
            'help': _("""
                <p class="o_view_nocontent_smiling_face">
                    All done!
                </p>
                <p>
                    Create new transactions, or make sure that there is no active filter in the search bar.
                </p>
            """),
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
        remaining_line_id = None
        if batch_size and len(st_line_ids) > batch_size:
            remaining_line_id = st_line_ids[batch_size]
            st_line_ids = st_line_ids[:batch_size]

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

        # If the next statement line has never been auto reconciled yet, force the trigger.
        if remaining_line_id:
            remaining_st_line = self.env['account.bank.statement.line'].browse(remaining_line_id)
            if nb_auto_reconciled_lines or not remaining_st_line.cron_last_check:
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
            domains = product(
                [
                    ('name', '=ilike', self.partner_name),
                    ('name', 'ilike', self.partner_name),
                ],
                [
                    ('company_id', '=', self.company_id.id),
                    ('company_id', '=', False),
                ],
            )
            for domain in domains:
                partner = self.env['res.partner'].search(list(domain) + [('parent_id', '=', False)], limit=1)
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

        return self.env['res.partner']

    def _get_st_line_strings_for_matching(self, allowed_fields=None):
        """ Collect the strings that could be used on the statement line to perform some matching.

        :param allowed_fields: A explicit list of fields to consider.
        :return: A list of strings.
        """
        self.ensure_one()

        st_line_text_values = []
        if not allowed_fields or 'payment_ref' in allowed_fields:
            if self.payment_ref:
                st_line_text_values.append(self.payment_ref)
        if not allowed_fields or 'narration' in allowed_fields:
            value = html2plaintext(self.narration or "")
            if value:
                st_line_text_values.append(value)
        if not allowed_fields or 'ref' in allowed_fields:
            if self.ref:
                st_line_text_values.append(self.ref)
        return st_line_text_values

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    @api.model
    def get_view(self, view_id=None, view_type='form', **options):
        # EXTENDS base
        # include widget on field 'statement_id' to avoid a module update (required to get line_ids in multi-edit mode)
        # TO BE REMOVED IN MASTER
        res = super().get_view(view_id=view_id, view_type=view_type, options=options)
        if view_type == 'tree':
            tree_view = self.env.ref('account_accountant.view_bank_statement_line_tree_bank_rec_widget')
            tree = etree.fromstring(res['arch'])
            xpath = "//field[@name='statement_id']"
            field_elems = tree.xpath(xpath)
            if res.get('id') == tree_view.id and field_elems and not field_elems[0].get('widget'):
                arch_tree = etree.fromstring(tree_view.arch)
                arch_tree.xpath(xpath)[0].attrib['widget'] = "bankrec_many2one_multi_id"
                tree_view.with_context({}).sudo().write({'arch': etree.tostring(arch_tree, encoding='unicode')})
                return super().get_view(view_id=view_id, view_type=view_type, options=options)
        return res
