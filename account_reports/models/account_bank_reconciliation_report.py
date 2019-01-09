# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.tools.misc import format_date
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT

from datetime import datetime


class account_bank_reconciliation_report(models.AbstractModel):
    _name = 'account.bank.reconciliation.report'
    _description = 'Bank Reconciliation Report'
    _inherit = "account.report"

    filter_date = {'date': '', 'filter': 'today'}

    #used to enumerate the 'layout' lines with a distinct ID
    line_number = 0

    def _get_columns_name(self, options):
        return [
            {'name': ''},
            {'name': _("Date")},
            {'name': _("Reference")},
            {'name': _("Amount"), 'class': 'number'},
        ]

    def _add_title_line(self, options, currency, title, amount=None, level=0, date=None):
        self.line_number += 1
        return {
            'id': 'line_' + str(self.line_number),
            'name': title,
            'columns': [{'name': v} for v in [
                date and format_date(self.env, date) or '',
                '', amount and self.format_value(amount, currency) or '']
            ],
            'level': level,
        }

    def _add_total_line(self, currency, amount):
        self.line_number += 1
        return {
            'id': 'line_' + str(self.line_number),
            'name': _('Total Virtual GL Balance'),
            'columns': [{'name': v} for v in ["", "", self.format_value(amount, currency)]],
            'level': 1,
            'class': 'total',
        }

    def _add_bank_statement_line(self, currency, line, amount):
        name = line.name
        return {
            'id': str(line.id),
            'caret_options': 'account.bank.statement.line',
            'model': 'account.bank.statement.line',
            'name': len(name) >= 85 and name[0:80] + '...' or name,
            'columns': [{'name': v} for v in [format_date(self.env, line.date), line.ref, self.format_value(amount, currency)]],
            'class': 'o_account_reports_level3',
        }

    def print_pdf(self, options):
        options['active_id'] = self.env.context.get('active_id')
        return super(account_bank_reconciliation_report, self).print_pdf(options)

    def print_xlsx(self, options):
        options['active_id'] = self.env.context.get('active_id')
        return super(account_bank_reconciliation_report, self).print_xlsx(options)

    @api.model
    def _get_bank_rec_report_data(self, options, journal):
        # General data + setup
        rslt = {}

        accounts = journal.default_debit_account_id + journal.default_credit_account_id
        company = journal.company_id
        amount_field = 'amount_currency' if journal.currency_id else 'balance'

        # Get total already accounted.
        self._cr.execute('''
            SELECT SUM(aml.''' + amount_field + ''')
            FROM account_move_line aml
            WHERE aml.date <= %s AND aml.company_id = %s AND aml.account_id IN %s
        ''', [self.env.context['date_to'], journal.company_id.id, tuple(accounts.ids)])
        rslt['total_already_accounted'] = self._cr.fetchone()[0] or 0.0

        # Payments not reconciled with a bank statement line
        self._cr.execute('''
            SELECT
                aml.id,
                aml.name,
                aml.ref,
                aml.date,
                aml.''' + amount_field + '''                    AS balance
            FROM account_move_line aml
            LEFT JOIN res_company company                       ON company.id = aml.company_id
            LEFT JOIN account_account_type account_type         ON account_type.id = aml.user_type_id
            LEFT JOIN account_bank_statement_line st_line       ON st_line.id = aml.statement_line_id
            WHERE aml.date <= %s
            AND aml.company_id = %s
            AND aml.journal_id = %s
            AND account_type.type = 'liquidity'
            AND full_reconcile_id IS NULL
            AND (aml.statement_line_id IS NULL OR st_line.date > %s)
            AND (company.account_bank_reconciliation_start IS NULL OR aml.date >= company.account_bank_reconciliation_start)
            ORDER BY aml.date DESC, aml.id DESC
        ''', [self._context['date_to'], journal.company_id.id, journal.id, self._context['date_to']])
        rslt['not_reconciled_payments'] = self._cr.dictfetchall()

        # Bank statement lines not reconciled with a payment
        rslt['not_reconciled_st_positive'] = self.env['account.bank.statement.line'].search([
            ('statement_id.journal_id', '=', journal.id),
            ('date', '<=', self._context['date_to']),
            ('journal_entry_ids', '=', False),
            ('amount', '>', 0),
            ('company_id', '=', company.id)
        ])

        rslt['not_reconciled_st_negative'] = self.env['account.bank.statement.line'].search([
            ('statement_id.journal_id', '=', journal.id),
            ('date', '<=', self._context['date_to']),
            ('journal_entry_ids', '=', False),
            ('amount', '<', 0),
            ('company_id', '=', company.id)
        ])

        # Final
        last_statement = self.env['account.bank.statement'].search([
            ('journal_id', '=', journal.id),
            ('date', '<=', self._context['date_to']),
            ('company_id', '=', company.id)
        ], order="date desc, id desc", limit=1)
        rslt['last_st_balance'] = last_statement.balance_end
        rslt['last_st_end_date'] = last_statement.date

        return rslt

    @api.model
    def _get_lines(self, options, line_id=None):
        journal_id = self._context.get('active_id') or options.get('active_id')
        journal = self.env['account.journal'].browse(journal_id)
        report_currency = journal.currency_id or journal.company_id.currency_id

        # Don't display twice the same account code.
        accounts = journal.default_debit_account_id + journal.default_credit_account_id
        if journal.default_debit_account_id == journal.default_credit_account_id:
            accounts = journal.default_debit_account_id

        # Fetch data
        report_data = self._get_bank_rec_report_data(options, journal)

        # Compute totals
        unrec_tot = sum([-(aml_values['balance']) for aml_values in report_data['not_reconciled_payments']])
        outstanding_plus_tot = sum([st_line.amount for st_line in report_data['not_reconciled_st_positive']])
        outstanding_minus_tot = sum([st_line.amount for st_line in report_data['not_reconciled_st_negative']])
        computed_stmt_balance = report_data['total_already_accounted'] + outstanding_plus_tot + outstanding_minus_tot + unrec_tot
        difference = computed_stmt_balance - report_data['last_st_balance']

        # Build report
        lines = []

        lines.append(self._add_title_line(
            options, report_currency, _("Virtual GL Balance"),
            amount=None if self.env.user.company_id.totals_below_sections else computed_stmt_balance, level=0)
        )

        gl_title = _("Current balance of account %s")
        if len(accounts) > 1:
            gl_title = _("Current balance of accounts %s")

        accounts_string = ', '.join(accounts.mapped('code'))
        lines.append(self._add_title_line(
            options, report_currency, gl_title % accounts_string,
            level=1, amount=report_data['total_already_accounted'],
            date=datetime.strptime(options['date']['date'], DEFAULT_SERVER_DATE_FORMAT))
        )

        lines.append(self._add_title_line(options, report_currency, _("Operations to Process"), level=1))

        if report_data.get('not_reconciled_st_positive') or report_data.get('not_reconciled_st_negative'):
            lines.append(self._add_title_line(options, report_currency, _("Unreconciled Bank Statement Lines"), level=2))
            for line in report_data.get('not_reconciled_st_positive', []):
                lines.append(self._add_bank_statement_line(report_currency, line, line.amount))

            for line in report_data.get('not_reconciled_st_negative', []):
                lines.append(self._add_bank_statement_line(report_currency, line, line.amount))

        if report_data.get('not_reconciled_payments'):
            lines.append(self._add_title_line(options, report_currency, _("Validated Payments not Linked with a Bank Statement Line"), level=2))
            for aml_values in report_data['not_reconciled_payments']:
                    self.line_number += 1
                    line_description = line_title = aml_values['ref']
                    if line_description and len(line_description) > 83 and not self.env.context.get('print_mode'):
                        line_description = line_description[:80] + '...'
                    lines.append({
                        'id': aml_values['id'],
                        'name': aml_values['name'],
                        'columns': [
                            {'name': format_date(self.env, aml_values['date'])},
                            {'name': line_description, 'title': line_title, 'style': 'display:block;'},
                            {'name': self.format_value(-aml_values['balance'], report_currency)},
                        ],
                        'class': 'o_account_reports_level3',
                        'caret_options': 'account.payment',
                    })

        if self.env.user.company_id.totals_below_sections:
            lines.append(self._add_total_line(report_currency, computed_stmt_balance))

        lines.append(self._add_title_line(
            options, report_currency, _("Last Bank Statement Ending Balance"),
            level=0, amount=report_data['last_st_balance'], date=report_data['last_st_end_date'])
        )
        last_line = self._add_title_line(
            options, report_currency, _("Unexplained Difference"),
            level=0, amount=difference
        )
        last_line['title_hover'] = _("""Difference between Virtual GL Balance and Last Bank Statement Ending Balance.\n
If non-zero, it could be due to
  1) some bank statements being not yet encoded into Odoo
  2) payments double-encoded""")
        #NOTE: anyone trying to explain the 'unexplained difference' should check
        # * the list of 'validated payments not linked with a statement line': maybe an operation was recorded
        #   as a new payment when processing a statement, instead of choosing the blue line corresponding to
        #   an already existing payment
        # * the starting and ending balance of the bank statements, to make sure there is no gap between them.
        # * there's no 'draft' move linked with a bank statement
        line_currency = self.env.context.get('line_currency', False)
        if self.env.context.get('no_format'):
            last_line['columns'][-1]['title'] = self.format_value(computed_stmt_balance, line_currency) - self.format_value(report_data['last_st_balance'], line_currency)
        else:
            last_line['columns'][-1]['title'] = self.format_value(computed_stmt_balance, line_currency) + " - " + self.format_value(report_data['last_st_balance'], line_currency)
        lines.append(last_line)

        return lines

    @api.model
    def _get_report_name(self):
        journal_id = self._context.get('active_id')
        if journal_id:
            journal = self.env['account.journal'].browse(journal_id)
            return _("Bank Reconciliation") + ': ' + journal.name
        return _("Bank Reconciliation")
