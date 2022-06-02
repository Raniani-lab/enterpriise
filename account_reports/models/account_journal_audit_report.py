# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, _, fields
from odoo.tools import format_date, date_utils, get_lang
from collections import defaultdict

import ast
import datetime


class ReportAccountJournalAudit(models.AbstractModel):
    _name = "account.journal.audit"
    _description = "Journal Audit Report"
    _inherit = 'account.report'

    filter_multi_company = None
    filter_date = {'mode': 'range', 'filter': 'this_year'}
    filter_all_entries = False
    filter_journals = True
    filter_unfold_all = False
    filter_sort_by_date = False
    filter_group_by_months = False
    filter_show_payment_lines = False

    @api.model
    def _get_templates(self):
        res = super()._get_templates()
        res.update({
            'search_template': 'account_reports.search_template_journal_audit_report',
            'line_template': 'account_reports.line_template_journal_audit_report',
            'main_table_header_template': 'account_reports.main_table_header_journal_audit_report',
            'main_template': 'account_reports.main_template_journal_audit_report',
        })
        return res

    # Override: disable multicompany
    @api.model
    def _get_filter_journals(self):
        return self.env['account.journal'].search([('company_id', 'in', [self.env.company.id, False])], order="company_id, name")

    @api.model
    def _get_options(self, previous_options=None):
        options = super(ReportAccountJournalAudit, self)._get_options(previous_options=previous_options)
        options.setdefault('date', {})
        options['date'].setdefault('date_to', fields.Date.context_today(self))
        return options

    @api.model
    def _get_report_name(self):
        return _("Journals Audit")

    @api.model
    def _get_columns_name(self, options):
        # The report will only display a single table. So we need to define enough columns for each journal,
        # even if not all of them are used for each journal, as we are instead redefining a column line per journal.
        return [
            {'name': _('Name'), 'class': 'o_account_report_line_ellipsis'},
            {'name': _('Account'), 'class': 'o_account_report_line_ellipsis'},
            {'name': _('Label'), 'class': 'o_account_report_line_ellipsis'},
            {'name': _('Debit'), 'class': 'number'},
            {'name': _('Credit'), 'class': 'number'},
            {'name': '', 'class': 'o_account_report_line_ellipsis'},
            {'name': '', 'class': 'text-right'},
        ]

    @api.model
    def _need_to_unfold(self, line_id, options):
        """ Returns True if the line with the given ID should be unfolded in the report."""
        return line_id in options.get('unfolded_lines') or options.get('unfold_all')

    @api.model
    def _get_lines(self, options, line_id=None):
        """ Returns the lines of the report."""
        offset = int(options.get('lines_offset', 0))
        remaining_lines = int(options.get('lines_remaining', 0))
        remaining_moves = int(options.get('moves_remaining', 0))
        current_balance = float(options.get('lines_progress', 0))
        sort_by_date = options.get('sort_by_date')

        # 1.Build lines SQL query
        tables, where_clause, where_params = self._query_get(self._force_strict_range(options))
        limit_clause = ""
        line_model = None
        line_markup = ""
        if line_id:
            # Parse the generic line id given to the line.
            # A line id is set as such: markup-model-id. if the line as parent, their id will be included, sperated by a '|'
            # Example: parent_markup-parent_model-parent_id|markup-model-id
            parsed_line_id = self._parse_line_id(line_id)
            # Only the line id itself interest us, not the parent ones.
            line_markup = parsed_line_id[-1][0]
            line_model = parsed_line_id[-1][1]
            parsed_id = parsed_line_id[-1][2]
            if line_model == 'account.journal':
                where_clause += ' AND "account_move_line".journal_id = %s'
                where_params += [parsed_id]
            elif line_model == 'account.move':
                journal_id = parsed_line_id[0][2]
                where_clause += ' AND am.id = %s AND "account_move_line".journal_id = %s'
                where_params += [parsed_id, journal_id]
            elif line_model == 'month':
                where_clause += ' AND "account_move_line".journal_id = %s AND am.date >= %s AND am.date <= %s'
                # The id of month line is a tuple, as such: (journal_id, year, month).
                date = datetime.date(int(parsed_id[1]), int(parsed_id[2]), 1)
                where_params += [parsed_id[0], date_utils.start_of(date, 'month'), date_utils.end_of(date, 'month')]

            if offset or remaining_lines or remaining_moves:
                # when using "load more", we add a limit and offset to the query to avoid fetching unneeded lines
                limit_clause = 'LIMIT %s OFFSET %s'
                where_params += [self.MAX_LINES, offset]
        # 1.1.Get lines values
        select = """
                    SELECT 
                        "account_move_line".id as move_line_id,
                        "account_move_line".name,
                        "account_move_line".amount_currency,
                        "account_move_line".tax_base_amount,
                        am.id as move_id,
                        am.name as move_name,
                        am.journal_id,
                        am.date,
                        am.currency_id as move_currency,
                        am.amount_total_in_currency_signed as amount_currency_total,
                        am.currency_id != cp.currency_id as is_multicurrency,
                        (SELECT COUNT(*) FROM account_move_line aml WHERE aml.move_id = am.id) AS move_line_count,
                        p.name as partner_name,
                        acc.code as account_code,
                        acc.name as account_name,
                        acc.internal_type as account_type,
                        COALESCE("account_move_line".debit, 0) as debit,
                        COALESCE("account_move_line".credit, 0) as credit,
                        COALESCE("account_move_line".balance, 0) as balance,
                        j.name as journal_name,
                        j.code as journal_code,
                        j.type as journal_type,
                        j.currency_id as journal_currency,
                        journal_curr.name as journal_currency_name,
                        cp.currency_id as company_currency,
                        CASE WHEN j.type = 'sale' THEN am.payment_reference WHEN j.type = 'purchase' THEN am.ref ELSE '' END as reference,
                        array_remove(array_agg(DISTINCT tax.name), NULL) as taxes,
                        array_remove(array_agg(DISTINCT tag.name), NULL) as tax_grids
                    FROM """ + tables + """
                    JOIN account_move am ON am.id = "account_move_line".move_id
                    JOIN account_account acc ON acc.id = "account_move_line".account_id
                    LEFT JOIN res_partner p ON p.id = "account_move_line".partner_id
                    JOIN account_journal j ON j.id = am.journal_id
                    JOIN res_company cp ON cp.id = am.company_id
                    LEFT JOIN account_move_line_account_tax_rel aml_at_rel ON aml_at_rel.account_move_line_id = "account_move_line".id
                    LEFT JOIN account_tax parent_tax ON parent_tax.id = aml_at_rel.account_tax_id and parent_tax.amount_type = 'group'
                    LEFT JOIN account_tax_filiation_rel tax_filiation_rel ON tax_filiation_rel.parent_tax = parent_tax.id
                    LEFT JOIN account_tax tax ON (tax.id = aml_at_rel.account_tax_id and tax.amount_type != 'group') or tax.id = tax_filiation_rel.child_tax
                    LEFT JOIN account_account_tag_account_move_line_rel tag_rel ON tag_rel.account_move_line_id = "account_move_line".id
                    LEFT JOIN account_account_tag tag on tag_rel.account_account_tag_id = tag.id
                    LEFT JOIN res_currency journal_curr on journal_curr.id = j.currency_id
                    WHERE """ + where_clause + """
                    GROUP BY "account_move_line".id, am.id, p.id, acc.id, j.id, cp.id, journal_curr.id
                    ORDER BY j.id, CASE when am.name = '/' then 1 else 0 end,
                    """ + (" am.date, am.name," if sort_by_date else " am.name , am.date,") + """
                    CASE acc.internal_type
                      WHEN 'payable' THEN 1
                      WHEN 'receivable' THEN 1
                      WHEN 'liquidity' THEN 5
                      ELSE 2
                   END,
                   "account_move_line".tax_line_id NULLS FIRST
                   """ + limit_clause + """
                """

        # 1.2.Fetch data from DB
        self.env.cr.execute(select, where_params)
        results = self.env.cr.dictfetchall()
        if not results:
            return []
        # 2.1.Get the journals cumulative starting balances
        journal_starting_balances = {}
        if not line_id or line_model == 'account.journal':
            # Get the starting balance for each journal, grouped by months.
            # The starting balance of a month is the ending balance of the previous one if any, or 0
            tables, where_clause, where_params = self._query_get(options)
            select = """
                SELECT journal.id,
                       cast(date_trunc('month', "account_move_line".date) as date) as month,
                       COALESCE(LAG(sum("account_move_line".balance), 1) over (partition by journal.id order by journal.id, date_trunc('month', "account_move_line".date)), 0) as starting_balance,
                       sum(sum("account_move_line".balance)) over (partition by journal.id order by journal.id, date_trunc('month', "account_move_line".date)) as ending_balance
                FROM """ + tables + """
                JOIN account_journal journal ON journal.id = "account_move_line".journal_id AND "account_move_line".account_id = journal.default_account_id
                WHERE """ + where_clause + """
                AND journal.type = 'bank'
                GROUP BY journal.id, date_trunc('month', "account_move_line".date)                  
            """
            self.env.cr.execute(select, where_params)
            journal_starting_balances = self.env.cr.dictfetchall()

        # 3.Create a dict with the report hierarchy to ease line creation
        grouped_lines = self._group_lines(options, results, journal_starting_balances)

        # 4.Build report lines
        lines = []
        for journal_index, (journal_key, journal_vals) in enumerate(grouped_lines.items()):
            # The first journal, if all lines are folded, will be unfolded to display something on the screen.
            self._open_journal_line_if_needed(options, journal_key, journal_index)
            needs_journal_lines = not line_id or (line_model == 'account.journal' and line_markup != 'load_more')
            needs_balance_line = not line_id or (line_model == 'account.journal' and line_markup == 'load_more')
            if needs_journal_lines:
                lines.append(self._get_journal_line(options, journal_key, journal_vals, journal_index == 0))

            if self._need_to_unfold(journal_key, options):
                if options.get('group_by_months'):
                    for month_key, month_vals in journal_vals['lines'].items():
                        needs_month_lines = not line_id or (line_model in ('account.journal', 'month') and line_markup != 'load_more')
                        needs_balance_line = not line_id or (line_model in ('account.journal', 'month') and line_markup == 'load_more')
                        month_lines = self._get_lines_for_group(options, month_key, month_vals, journal_vals['type'], journal_vals['id'], offset, remaining_lines, remaining_moves, current_balance, needs_month_lines, journal_vals['initial_balances'], needs_balance_line)
                        if needs_month_lines and month_lines:
                            lines.append({
                                'id': month_key,
                                'name': month_vals['name'],
                                'level': 2,
                                'columns': [],
                                'unfoldable': True,
                                'unfolded': self._need_to_unfold(month_key, options),
                                'parent_id': journal_key,
                                'colspan': 7,
                            })
                        if self._need_to_unfold(month_key, options):
                            lines.extend(month_lines)

                else:
                    lines.extend(self._get_lines_for_group(options, journal_key, journal_vals, journal_vals['type'], journal_vals['id'], offset, remaining_lines, remaining_moves, current_balance, needs_journal_lines, journal_vals['initial_balances'], needs_balance_line))

        return lines

    ##########################################################################
    # Get lines methods
    ##########################################################################

    @api.model
    def _get_lines_for_group(self, options, parent_key, group_vals_dict, journal_type, journal_id, current_offset, remaining_lines, remaining_moves, current_balance, needs_group_lines, initial_balances, needs_balance_line):
        """ Create the report lines for a group of moves. A group is either a journal, or a month if the report is grouped by month.
        """
        lines = []
        if not current_balance:
            if options.get('group_by_months'):
                current_balance = initial_balances.get(group_vals_dict['date'], {}).get('initial', 0)
            else:
                current_balance = initial_balances.get('initial', 0)
        if needs_group_lines:
            lines.append(self._get_columns_line(options, parent_key, journal_type))
        if needs_group_lines and journal_type == 'bank':
            lines.extend(self._get_journal_balance_line(options, parent_key, journal_id, current_balance, is_starting_balance=True))

        move_line_vals_dict = group_vals_dict['lines']
        # Keep track of the amount of aml displayed, to avoid displaying too many lines.
        if not remaining_lines and not remaining_moves:
            starting_remaining_lines = sum([len(move_line_vals_list) for move_line_vals_list in move_line_vals_dict.values()])
            load_more_remaining = starting_remaining_lines
            load_more_remaining_moves = len(move_line_vals_dict)
        else:
            starting_remaining_lines = remaining_lines
            load_more_remaining = remaining_lines
            load_more_remaining_moves = remaining_moves
        load_more_counter = self._context.get('print_mode') and load_more_remaining or self.MAX_LINES
        for move_key, move_line_vals_list in move_line_vals_dict.items():
            line_amount = len(move_line_vals_list)
            move_line_count = move_line_vals_list[0]['move_line_count']
            if move_line_count > line_amount:  # Do not render a move for which we didn't fetch all the lines.
                break
            # Do not display moves on bank journal that does not move the liquidity account
            is_bank_without_liquidity = move_line_vals_list[0]['journal_type'] == 'bank' and not any(line for line in move_line_vals_list if line['account_type'] == 'liquidity')
            if not options.get('show_payment_lines') and is_bank_without_liquidity:
                load_more_remaining -= line_amount
                load_more_remaining_moves -= 1
                continue

            load_more_counter -= line_amount
            # Don't show more line than load_more_counter.
            if load_more_counter < 0:
                break
            load_more_remaining -= line_amount
            load_more_remaining_moves -= 1
            is_multicurrency = move_line_vals_list[0]['is_multicurrency']

            # Create the first line separately, as we want to give it some specific behavior and styling
            if move_line_vals_list[0]['journal_type'] == 'bank' and move_line_vals_list[0]['account_type'] != 'liquidity':
                current_balance += -move_line_vals_list[0]['balance']

            display_balance = False if options.get('show_payment_lines') and is_bank_without_liquidity else current_balance
            lines.append(self._get_first_move_line(options, parent_key, move_key, move_line_vals_list[0], display_balance))

            for line_index, move_line_vals in enumerate(move_line_vals_list[1:]):
                if move_line_vals['journal_type'] == 'bank' and move_line_vals['account_type'] != 'liquidity':
                    current_balance += -move_line_vals['balance']
                display_balance = False if options.get('show_payment_lines') and is_bank_without_liquidity else current_balance
                lines.extend(self._get_aml_line(options, parent_key, move_line_vals, display_balance, line_index))

                multicurrency_name = self._get_aml_line_name(options, 1, move_line_vals_list[0])
                if is_multicurrency \
                        and len(move_line_vals_list) == 2 \
                        and self.user_has_groups('base.group_multi_currency') \
                        and lines[-1]['name'] != multicurrency_name:
                    lines.append({
                        'id': self._get_generic_line_id('account.move', move_line_vals_list[0]['move_line_id'],
                                                        markup='ammount_currency_total'),
                        'name': multicurrency_name,
                        'level': 3,
                        'parent_id': parent_key,
                        'columns': [],
                        'class': 'o_account_reports_ja_name_muted',
                        'colspan': 7,
                    })
        # If needed, display a load more line. Otherwise, display the ending balance if relevant.
        if load_more_remaining > 0:
            current_offset += (starting_remaining_lines - load_more_remaining)
            lines.append(self._get_load_more_line(options, parent_key, current_offset, load_more_remaining, load_more_remaining_moves, current_balance))
        elif (needs_group_lines or needs_balance_line) and journal_type == 'bank':
            lines.extend(self._get_journal_balance_line(options, parent_key, journal_id, current_balance, is_starting_balance=False))

        # Get the tax summary section line
        if needs_group_lines and group_vals_dict.get('tax_data'):
            # This is a special line with a special template to render it.
            # It will contain two tables, which are the tax report and tax grid summary sections.
            tax_report_lines = self._get_tax_report_line_for_sections(options, group_vals_dict.get('tax_data'))
            tax_grid_summary_lines = self._get_tax_grids_summary(options, group_vals_dict.get('tax_data'))
            if tax_report_lines or tax_grid_summary_lines:
                lines.append({
                    'id': 'total',
                    'name': '',
                    'parent_id': parent_key,
                    'journal_id': journal_id,
                    'is_tax_section_line': True,
                    'tax_report_lines': tax_report_lines,
                    'tax_grid_summary_lines': tax_grid_summary_lines,
                    'date_from': group_vals_dict.get('tax_data', {}).get('date_from'),
                    'date_to': group_vals_dict.get('tax_data', {}).get('date_to'),
                    'columns': [],
                    'colspan': 7,
                    'level': 3,
                })

        return lines

    @api.model
    def _get_columns_line(self, options, parent_key, journal_type):
        """ returns the line displaying the columns used by the journal.
        The report isn't using the table header, as different journal type needs different columns.

        :param options: The report options
        :param parent_key: the key of the parent line, journal or month
        :param journal_type: the journal type
        """
        columns = [
            {'name': _('Name')},
            {'name': _('Account')},
            {'name': _('Label')},
            {'name': _('Debit')},
            {'name': _('Credit')},
        ]
        # The system needs to always have the same column amount. This is hacky, but it works.
        if journal_type in ['sale', 'purchase']:
            columns.extend([
                {'name': _('Taxes'), 'style': 'width: 5%;' if not self._context.get('print_mode') else ''},
                {'name': _('Tax Grids')},
            ])
        elif journal_type == 'bank':
            columns.extend([
                {'name': _('Balance'), 'class': 'text-right', 'style': 'width: 5%;' if not self._context.get('print_mode') else ''},
                {'name': ''},
            ])
        else:
            columns.extend([
                {'name': '', 'style': 'width: 5%;' if not self._context.get('print_mode') else ''},
                {'name': ''},
            ])

        return {
            'id': self._get_generic_line_id('', parent_key, markup='headers'),
            'name': columns[0]['name'],
            'columns': columns[1:],
            'level': 3,
            'parent_id': parent_key,
            'class': 'o_account_reports_ja_header_line',
        }

    @api.model
    def _get_journal_line(self, options, journal_key, journal_vals, is_first_journal):
        """ returns the line that is representing a journal in the report.

        :param options: The report options
        :param journal_key: The line id for this journal
        :param journal_vals: The values for this journal
        :param is_first_journal: If this is the first journal in the report or not. Additional journals will have a page break used when printing in PDF.
        """
        name = '%s (%s)' % (journal_vals['name'], journal_vals['code'])
        if journal_vals['currency'] and journal_vals['currency'] != journal_vals['company_currency']:
            name += ' [%s]' % journal_vals['currency_name']
        # return journal line, and header line
        return {
            'id': journal_key,
            'name': name,
            'level': 1,
            'columns': [],
            'unfoldable': True,
            'unfolded': self._need_to_unfold(journal_key, options),
            'journal_id': journal_vals['id'],
            'journal_type': journal_vals['type'],
            'class': 'o_account_reports_ja_journal_line',
            'colspan': 7,
            'page_break': not is_first_journal
        }

    @api.model
    def _get_journal_balance_line(self, options, parent_key, journal_id, balance, is_starting_balance=True):
        """ Returns the line holding information about either the starting, or ending balance of a bank journal in the selected period.

        :param options: dictionary containing the options for the current report
        :param parent_key: the key of the parent line, either the journal or the month
        :param journal_id: the id of the journal
        :param balance: the starting/ending balance of the journal
        :param is_starting_balance: whether the balance is the starting or ending balance. Used for formating.
        """
        format_balance = self.format_value(balance, blank_if_zero=False)
        return [{
            'id': self._get_generic_line_id('account.journal', journal_id, markup='%s balance line' % 'starting' if is_starting_balance else 'ending'),
            'name': '',
            'columns': [
                {'name': ''},
                {'name': ''},
                {'name': ''},
                {'name': _('Starting Balance :') if is_starting_balance else _('Ending Balance :'), 'class': 'font-italic text-right'},
                {'name': format_balance, 'no_format': balance, 'class': 'font-italic text-right', 'style': 'width: 5%;' if not self._context.get('print_mode') else ''},
                {'name': ''},
            ],
            'level': 3,
            'parent_id': parent_key,
        }]

    @api.model
    def _get_first_move_line(self, options, parent_key, line_key, values, new_balance=False):
        """ Returns the first line of a move.
        It is different from the other lines, as it contains more information such as the date, partner, and a link to the move itself.

        :param options: The report options.
        :param parent_key: The id of the lines that should be parenting the aml lines. Should be the group line (either the journal, or month).
        :param line_key: The id of the move line itself.
        :param values: The values of the move line.
        :param new_balance: The new balance of the move line, if any. Use to display the cumulated balance for bank journals.
        """
        # Helps to format the line. If a line is linked to a partner but the account isn't receivable or payable, we want to display it in blue.
        not_receivable_with_partner = values['partner_name'] and values['account_type'] not in ('receivable', 'payable')
        return {
            'id': line_key,
            'name': values['move_name'],
            'level': 3,
            'date': values['date'],
            'columns': [
                {'name': '%s %s' % (values['account_code'], '' if values['partner_name'] else values['account_name']), 'name_right': values['partner_name'], 'class': 'o_account_report_line_ellipsis' + (' color-blue' if not_receivable_with_partner else ''), 'template': 'account_reports.cell_template_journal_audit_report'},
                {'name': values['name'], 'class': 'o_account_report_line_ellipsis'},
            ] + [{'name': self.format_value(n), 'no_format': n} for n in [values['debit'], values['credit']]] + self._get_move_line_additional_col(options, new_balance, values),
            'parent_id': parent_key,
            'move_id': values['move_id'],
            'class': 'o_account_reports_ja_move_line',
        }

    @api.model
    def _get_aml_line(self, options, parent_key, values, current_balance=False, line_index=False):
        """ Returns the line of an account move line.

        :param options: The report options.
        :param parent_key: The id of the lines that should be parenting the aml lines. Should be the group line (either the journal, or month).
        :param values: The values of the move line.
        :param current_balance: The current balance of the move line, if any. Use to display the cumulated balance for bank journals.
        :param line_index: The index of the line in the move line list. Used to write additional information in the name, such as the move reference, or the ammount in currency.
        """
        if values['journal_type'] == 'bank' and values['account_type'] == 'liquidity':
            # Do not display bank lines for bank journals
            return []

        amounts = [{'name': self.format_value(n), 'no_format': n} for n in
                   [values['debit'], values['credit']]]
        return [{
            'id': self._get_generic_line_id('account.move', values['move_line_id']),
            'name': self._get_aml_line_name(options, line_index, values),
            'level': 3,
            'parent_id': parent_key,
            'columns': [
                           {'name': '%s %s' % (values['account_code'], values['account_name'])},
                           {'name': values['name']},
                       ] + amounts + self._get_move_line_additional_col(options, current_balance, values),
            'class': 'o_account_reports_ja_name_muted',
        }]

    @api.model
    def _get_aml_line_name(self, options, line_index, values):
        """ Returns the information to write as the name of the move lines, if needed.
        Typically, this is the move reference, or the amount in currency if we are in a multicurrency environment and the move is using a foreign currency.

        :param options: The report options.
        :param line_index: The index of the line in the move line list. We always want the reference second if existing and the amount in currency third if needed.
        :param values: The values of the move line.
        """
        amount_currency_name = ''
        if self.user_has_groups('base.group_multi_currency') and values['is_multicurrency']:
            amount_currency_name = _('Amount in currency: %s', self.format_value(values['amount_currency_total'], currency=self.env['res.currency'].browse(values['move_currency'])))
        if line_index == 0:
            return values['reference'] or amount_currency_name
        elif line_index == 1:
            return amount_currency_name

    @api.model
    def _get_move_line_additional_col(self, options, current_balance, values):
        """ Returns the additional columns to be displayed on an account move line.
        These are the column coming after the debit and credit columns.
        For a sale or purchase journal, they will contain the taxes' information.
        For a bank journal, they will contain the cumulated amount.

        :param current_balance: The current balance of the move line, if any.
        :param values: The values of the move line.
        """
        additional_col = []
        if values['journal_type'] in ['sale', 'purchase']:
            tax_val = ''
            if values['taxes']:
                tax_val = 'T: %s' % ', '.join(values['taxes'])
            elif values['tax_base_amount']:
                tax_val = 'B: %s' % self.format_value(values['tax_base_amount'], blank_if_zero=False)
            values['tax_grids'] = ', '.join(values['tax_grids'])
            additional_col.extend([
                {'name': tax_val, 'class': 'o_account_report_line_ellipsis',
                 'style': 'width: 5%;' if not self._context.get('print_mode') else ''},
                {'name': values['tax_grids']},
            ])
        if values['journal_type'] == 'bank' and values['account_type'] != 'liquidity' and current_balance:
            additional_col.extend([
                {'name': self.format_value(current_balance),
                 'no_format': current_balance,
                 'class': 'font-italic text-right',
                 'style': 'width: 5%;' if not self._context.get('print_mode') else ''},
                {'name': ''},
            ])
        # In bank journals, we do not want to display the balance for payment line if they are shown
        elif values['journal_type'] == 'bank' and values['account_type'] != 'liquidity' and not current_balance:
            additional_col.extend([
                {'name': ''},
                {'name': ''},
            ])
        return additional_col

    @api.model
    def _get_load_more_line(self, options, parent_key, offset, remaining, remaining_moves, current_balance):
        """ Returns a line used to load additional account move lines if there is too many to show in the report.
        It will hold information such as the cumulated balance progress, the remaining lines,... that can be reused in the _get_lines() to offset and limit the query.

        :param options: The report options.
        :param parent_key: The id of the lines that should be parenting the aml lines. Should be the group line (either the journal, or month).
        :param offset: The offset of the move lines to load.
        :param remaining: The number of remaining lines to load.
        :param remaining_moves: The number of remaining moves to load.
        :param current_balance: The current cumulated balance of the move lines, if any.
        """
        parsed_line_id = self._parse_line_id(parent_key)
        line_model = parsed_line_id[-1][1]
        parsed_id = parsed_line_id[-1][2]
        return {
            'id': self._get_generic_line_id(line_model, parsed_id, markup='load_more', parent_line_id=parent_key),
            'offset': offset,
            'progress': current_balance,
            'remaining': remaining,
            'remaining_moves': remaining_moves,
            'class': 'o_account_reports_load_more text-center',
            'parent_id': parent_key,
            'name': _('Load more... (%s remaining)', remaining_moves),
            'colspan': 7,
            'columns': [],
        }

    ##########################################################################
    # Helper methods
    ##########################################################################

    @api.model
    def _open_journal_line_if_needed(self, options, journal_key, journal_index):
        """ Default unfolding behavior. If we have not selected any journals, and no journal is unfolded yet, we unfold the first one.
        If we have selected one or more journals, they will all be unfolded by default.

        :param options: the report options.
        :param journal_key: the key of the journal we are looking to unfold if needed.
        :param journal_index: the index of the journal line in the report.
        """
        selected_journal_id = [j['id'] for j in options['journals'] if j['id'] != 'divider' and j['selected']]
        # Check the model of the lines in the unfolded lines, and check if any journal lines are unfolded.
        any_unfolded_journal = any(self._parse_line_id(unfolded_line)[-1][1] == 'account.journal' for unfolded_line in options['unfolded_lines'])
        if not selected_journal_id and not any_unfolded_journal and journal_index == 0 and journal_key not in options.get('unfolded_lines'):
            options.get('unfolded_lines').append(journal_key)
        elif selected_journal_id:
            journal_id = self._parse_line_id(journal_key)[-1][2]
            if journal_id in selected_journal_id and journal_key not in options.get('unfolded_lines'):
                options.get('unfolded_lines').append(journal_key)

    @api.model
    def _group_lines(self, options, line_vals_dict, journal_initial_balances):
        """ Group the line vals dict according to the options, to ease the actual line creation later on.

        :param options: The report options.
        :param line_vals_dict: The line vals dict to group
        :param journal_initial_balances: The journal initial and ending balances.
        :return: A grouped dict
        """
        group_by_months = options.get('group_by_months')
        res = {}
        for line_vals in line_vals_dict:
            journal_key = self._get_generic_line_id('account.journal', line_vals['journal_id'])
            # The first level is always journal lines
            if journal_key not in res:
                initial_balances = {}
                if line_vals['journal_type'] == 'bank':
                    for journal_balance in journal_initial_balances:
                        if journal_balance['id'] == line_vals['journal_id']:
                            if options.get('group_by_months'):
                                initial_balances.update({
                                    journal_balance['month']: {
                                        'initial': journal_balance['starting_balance'],
                                        'ending': journal_balance['ending_balance']
                                    }
                                })
                            else:
                                if journal_balance['month'] < fields.Date.to_date(options['date']['date_from']):
                                    initial_balances['initial'] = journal_balance['ending_balance']
                                else:
                                    initial_balances['ending'] = journal_balance['ending_balance']
                res[journal_key] = {
                    'id': line_vals['journal_id'],
                    'code': line_vals['journal_code'],
                    'name': line_vals['journal_name'],
                    'type': line_vals['journal_type'],
                    'currency': line_vals['journal_currency'],
                    'currency_name': line_vals['journal_currency_name'],
                    'company_currency': line_vals['company_currency'],
                    'initial_balances': initial_balances,
                    'lines': {},
                    'tax_data': {
                        'date_from': options.get('date', {}).get('date_from'),
                        'date_to': options.get('date', {}).get('date_to'),
                        'journal_id': line_vals['journal_id'],
                        'journal_type': line_vals['journal_type'],
                    }
                }
            # if we are grouping by months, we add an intermediate layer that is the month and year of the line(s)
            if group_by_months:
                current_move_date = fields.Date.from_string(line_vals['date'])
                month_key = self._get_generic_line_id('month', (line_vals['journal_id'], current_move_date.year, current_move_date.month), parent_line_id=journal_key)
                move_key = self._get_generic_line_id('account.move', line_vals['move_id'], parent_line_id=month_key)
                if month_key not in res[journal_key]['lines']:
                    date = datetime.date(int(current_move_date.year), int(current_move_date.month), 1)
                    res[journal_key]['lines'][month_key] = {
                        'name': format_date(self.env, current_move_date, date_format='MMM yyyy'),
                        'date': datetime.date(current_move_date.year, current_move_date.month, 1),
                        'type': line_vals['journal_type'],
                        'lines': {},
                        'tax_data': {
                            'date_from': date_utils.start_of(date, 'month'),
                            'date_to': date_utils.end_of(date, 'month'),
                            'journal_id': line_vals['journal_id'],
                            'journal_type': line_vals['journal_type'],
                        }
                    }
                if move_key not in res[journal_key]['lines'][month_key]['lines']:
                    res[journal_key]['lines'][month_key]['lines'][move_key] = []
                res[journal_key]['lines'][month_key]['lines'][move_key].append(line_vals)
            else:
                move_key = self._get_generic_line_id('account.move', line_vals['move_id'], parent_line_id=journal_key)
                if move_key not in res[journal_key]['lines']:
                    res[journal_key]['lines'][move_key] = []
                res[journal_key]['lines'][move_key].append(line_vals)
        return res

    @api.model
    def _get_tax_report_line_for_sections(self, options, data):
        """
        Overridden to make use of the generic tax report computation
        Works by forcing specific options into the tax report to only get the lines we need.
        The result is grouped by the country in which the tag exists in case of multivat environment.
        Returns a dictionary with the following structure:
        {
            Country : [
                {name, base_amount, tax_amount},
                {name, base_amount, tax_amount},
                {name, base_amount, tax_amount},
                ...
            ],
            Country : [
                {name, base_amount, tax_amount},
                {name, base_amount, tax_amount},
                {name, base_amount, tax_amount},
                ...
            ],
            ...
        }
        """
        tax_report_options = self._get_generic_tax_report_options(options, data)
        tax_report = self.env['account.generic.tax.report']
        tax_report_lines = tax_report.with_context(tax_report._set_context(tax_report_options))._get_lines(tax_report_options)

        tax_values = {}
        for tax_report_line in tax_report_lines:
            model, line_id = self._parse_line_id(tax_report_line.get('id'))[-1][1:]
            if model == 'account.tax':
                tax_values[line_id] = {
                    'base_amount': tax_report_line['columns'][0]['no_format'],
                    'tax_amount': tax_report_line['columns'][1]['no_format'],
                    'data_args': tax_report_line['caret_options_args'],
                }

        # Make the final data dict that will be used by the template, using the taxes information.
        taxes = self.env['account.tax'].browse(tax_values.keys())
        res = defaultdict(list)
        for tax in taxes:
            res[tax.country_id.name].append({
                'base_amount': self.format_value(tax_values[tax.id]['base_amount'], blank_if_zero=False),
                'tax_amount': self.format_value(tax_values[tax.id]['tax_amount'], blank_if_zero=False),
                'name': tax.name,
                'data_args': tax_values[tax.id]['data_args'],
            })

        # Return the result, ordered by country name
        return dict(sorted(res.items()))

    @api.model
    def _get_generic_tax_report_options(self, options, data):
        """
        Return an option dictionnary set to fetch the reports with the parameters needed for this journal.
        The important bits are the journals, date, and fetch the generic tax reports that contains all taxes.
        We also provide the information about wether to take all entries or only posted ones.
        """
        date_from = data.get('date_from')
        date_to = data.get('date_to')
        mode = 'range'
        if not date_to:
            date_to = fields.Date.context_today(self)
        if not date_from:
            mode = 'single'

        date_options = {
            'mode': mode,
            'strict_range': True,
            'date_from': date_from,
            'date_to': date_to
        }
        tax_report_options = self.env['account.generic.tax.report']._get_options()
        tax_report_options.update({
            'date': date_options,
            'journals': [{'id': data.get('journal_id'), 'type': data.get('journal_type'), 'selected': True}],
            'all_entries': options.get('all_entries'),
            'tax_report': 'generic',
            'fiscal_position': 'all',
            'multi_company': [{'id': self.env.company.id, 'name': self.env.company.name}],
        })
        return tax_report_options

    @api.model
    def _get_tax_grids_summary(self, options, data):
        """
        Fetches the details of all grids that have been used in the provided journal.
        The result is grouped by the country in which the tag exists in case of multivat environment.
        Returns a dictionary with the following structure:
        {
            Country : {
                tag_name: {+, -, impact},
                tag_name: {+, -, impact},
                tag_name: {+, -, impact},
                ...
            },
            Country : [
                tag_name: {+, -, impact},
                tag_name: {+, -, impact},
                tag_name: {+, -, impact},
                ...
            ],
            ...
        }
        """
        # Use the same option as we use to get the tax details, but this time to generate the query used to fetch the
        # grid information
        tax_report_options = self._get_generic_tax_report_options(options, data)
        tables, where_clause, where_params = self.env['account.generic.tax.report']._query_get(tax_report_options)
        query = """
            WITH tag_info (country_name, tag_id, tag_name, tag_sign, balance) as (
                SELECT
                    COALESCE(NULLIF(ir_translation.value, ''), country.name) country_name,
                    tag.id,
                    tag.name,
                    CASE WHEN tag.tax_negate IS TRUE THEN '-' ELSE '+' END,
                    SUM(COALESCE("account_move_line".balance, 0)
                        * CASE WHEN "account_move_line".tax_tag_invert THEN -1 ELSE 1 END
                        ) AS balance
                FROM account_account_tag tag
                JOIN account_account_tag_account_move_line_rel rel ON tag.id = rel.account_account_tag_id
                JOIN res_country country on country.id = tag.country_id
                LEFT JOIN ir_translation ON ir_translation.name = 'res.country,name' AND ir_translation.res_id = country.id AND ir_translation.type = 'model' AND ir_translation.lang = %s
                , """ + tables + """
                WHERE  """ + where_clause + """
                  AND applicability = 'taxes'
                  AND "account_move_line".id = rel.account_move_line_id
                GROUP BY country_name, tag.id
            )
            SELECT
                country_name,
                tag_id,
                REGEXP_REPLACE(tag_name, '^[+-]', '') AS name, -- Remove the sign from the grid name
                balance,
                tag_sign AS sign
            FROM tag_info
            ORDER BY country_name, name
        """
        lang = self.env.user.lang or get_lang(self.env).code
        self.env.cr.execute(query, [lang] + where_params)
        query_res = self.env.cr.fetchall()

        res = defaultdict(lambda: defaultdict(dict))
        opposite = {'+': '-', '-': '+'}
        for country_name, tag_id, name, balance, sign in query_res:
            res[country_name][name]['tag_id'] = tag_id
            res[country_name][name][sign] = self.format_value(balance, blank_if_zero=False)
            # We need them formatted, to ensure they are displayed correctly in the report. (E.g. 0.0, not 0)
            if not opposite[sign] in res[country_name][name]:
                res[country_name][name][opposite[sign]] = self.format_value(0, blank_if_zero=False)
            res[country_name][name][sign + '_no_format'] = balance
            res[country_name][name]['impact'] = self.format_value(res[country_name][name].get('+_no_format', 0) - res[country_name][name].get('-_no_format', 0), blank_if_zero=False)

        return res

    @api.model
    def _force_strict_range(self, options):
        ''' Duplicate options with the 'strict_range' enabled on the filter_date.
        :param options: The report options.
        :return:        A copy of the options.
        '''
        new_options = options.copy()
        new_options['date'] = new_options['date'].copy()
        new_options['date']['strict_range'] = True
        return new_options

    ###########################################################################
    # Actions
    ###########################################################################

    def action_open_move(self, options, params):
        """ Returns an action opening the form view of the selected move."""
        return {
            'type': 'ir.actions.act_window',
            'name': _('Invoice'),
            'res_model': 'account.move',
            'views': [[False, 'form']],
            'view_mode': 'form',
            'res_id': params.get('move_id'),
        }

    def tax_tag_template_open_aml(self, options, params=None):
        """ returns an action to open a tree view of the account.move.line having the selected tax tag """
        tag_id = params.get('tag_id')
        domain = [('tax_tag_ids', 'in', [tag_id]), ('company_id', 'in', self.env.company.ids)] + self.env['account.move.line']._get_tax_exigible_domain()
        # When grouped by month, we don't use the report dates directly, but the ones of the month. So they need to replace the ones in the options.
        new_options = options.copy()
        new_options['date'].update({
            'strict_range': True,
            'date_from': params and params.get('date_from') or options.get('date', {}).get('date_from'),
            'date_to': params and params.get('date_to') or options.get('date', {}).get('date_to'),
        })
        return self.open_action(new_options, domain)

    def action_dropdown_audit_default_tax_report(self, options, params):
        args = ast.literal_eval(params['args'])
        # See above
        new_options = options.copy()
        new_options['date'].update({
            'strict_range': True,
            'date_from': params and params.get('date_from') or options.get('date', {}).get('date_from'),
            'date_to': params and params.get('date_to') or options.get('date', {}).get('date_to'),
        })
        return self.env['account.generic.tax.report']._redirect_audit_default_tax_report(new_options, *args)

    def action_open_tax_journal_items(self, options, params):
        """
        Open the journal items related to the tax on this line.
        Take into account the given/options date and group by taxes then account.
        :param options: the report options.
        :param params: a dict containing the line params. (Dates, name, journal_id, tax_type)
        :return: act_window on journal items grouped by tax or tags and accounts.
        """
        ctx = {
            'search_default_posted': 0 if options.get('all_entries') else 1,
            'search_default_date_between': 1,
            'date_from': params and params.get('date_from') or options.get('date', {}).get('date_from'),
            'date_to': params and params.get('date_to') or options.get('date', {}).get('date_to'),
            'search_default_journal_id': params.get('journal_id'),
            'name_groupby': 1,
            'expand': 1,
        }
        if params and params.get('tax_type') == 'tag':
            ctx.update({
                'search_default_group_by_tax_tags': 1,
                'search_default_group_by_account': 1,
            })
        elif params and params.get('tax_type') == 'tax':
            ctx.update({
                'search_default_group_by_taxes': 1,
                'search_default_group_by_account': 1,
            })

        if params and 'journal_id' in params:
            ctx.update({
                'search_default_journal_id': [params['journal_id']],
            })

        if options and options.get('journals') and 'search_default_journal_id' not in ctx:
            selected_journals = [journal['id'] for journal in options['journals'] if journal.get('selected')]
            if len(selected_journals) == 1:
                ctx['search_default_journal_id'] = selected_journals

        return {
            'name': params.get('name'),
            'view_mode': 'tree,pivot,graph,kanban',
            'res_model': 'account.move.line',
            'views': [(self.env.ref('account.view_move_line_tree_grouped').id, 'list')],
            'type': 'ir.actions.act_window',
            'domain': [('display_type', 'not in', ('line_section', 'line_note'))],
            'context': ctx,
        }
