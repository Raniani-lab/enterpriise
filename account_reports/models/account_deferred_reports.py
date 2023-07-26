# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from dateutil.relativedelta import relativedelta
from odoo import models, fields, _, api, Command
from odoo.exceptions import UserError
from odoo.tools import groupby


class DeferredReportCustomHandler(models.AbstractModel):
    _name = 'account.deferred.report.handler'
    _inherit = 'account.report.custom.handler'
    _description = 'Deferred Expense Report Custom Handler'

    def _get_deferred_report_type(self):
        raise NotImplementedError("This method is not implemented in the deferred report handler.")

    def _custom_options_initializer(self, report, options, previous_options=None):
        super()._custom_options_initializer(report, options, previous_options=previous_options)
        options['columns'][0]['name'] = options['date']['string']
        options['columns'][0]['date_from'] = options['date']['date_from']
        options['columns'][0]['date_to'] = options['date']['date_to']
        if options.get('comparison'):
            for i in range(1, len(options['columns'])):
                options['columns'][i]['name'] = options['comparison']['periods'][i - 1]['string']
                options['columns'][i]['date_from'] = options['comparison']['periods'][i - 1]['date_from']
                options['columns'][i]['date_to'] = options['comparison']['periods'][i - 1]['date_to']
        options['columns'] = list(reversed(options['columns']))
        total_column = [{
            **options['columns'][0],
            'name': _('Total'),
            'date_from': '1900-01-01',
            'date_to': '9999-12-31',
        }]
        before_column = [{
            **options['columns'][0],
            'name': _('Before'),
            'date_from': '1900-01-01',
            'date_to': options['columns'][0]['date_from'],
        }]
        later_column = [{
            **options['columns'][0],
            'name': _('Later'),
            'date_from': options['columns'][-1]['date_to'],
            'date_to': '9999-12-31',
        }]
        options['columns'] = total_column + before_column + options['columns'] + later_column
        options['column_headers'] = []
        if self.env.company.generate_deferred_entries_method == 'manual':
            options['buttons'].append({'name': _('Generate entry'), 'action': 'action_generate_entry', 'sequence': 80})

    def action_generate_entry(self, options):
        journal = self.env.company.deferred_journal_id
        if not journal:
            raise UserError(_("Please set the deferred journal in the accounting settings."))
        options['all_entries'] = False  # We only want to create deferrals for posted moves
        lines = self._get_lines(options, filter_already_generated=True)
        period = (fields.Date.from_string('1900-01-01'), fields.Date.from_string(options['date']['date_to']))
        deferral_entry_period = self.env['account.report']._get_dates_period(*period, 'range', period_type='month')
        ref = _("Grouped Deferral Entry of %s", deferral_entry_period['string'])
        ref_rev = _("Reversal of Grouped Deferral Entry of %s", deferral_entry_period['string'])
        deferred_account = self.env.company.deferred_expense_account_id if self._get_deferred_report_type() == 'expense' else self.env.company.deferred_revenue_account_id
        move_lines, original_move_ids = self._get_deferred_lines(lines, deferred_account, period, self._get_deferred_report_type() == 'expense', ref)
        if not move_lines:
            raise UserError(_("No entry to generate."))

        original_moves = self.env['account.move'].browse(original_move_ids)
        deferred_move = self.env['account.move'].create({
            'move_type': 'entry',
            'deferred_original_move_ids': [Command.set(original_move_ids)],
            'journal_id': journal.id,
            'date': period[1],
            'auto_post': 'at_date',
            'ref': ref,
        })
        # We write the lines after creation, to make sure the `deferred_original_move_ids` is set.
        # This way we can avoid adding taxes for deferred moves.
        deferred_move.write({'line_ids': move_lines})
        reverse_move = deferred_move._reverse_moves()
        reverse_move.write({
            'date': deferred_move.date + relativedelta(days=1),
            'ref': ref_rev,
        })
        reverse_move.line_ids.name = ref_rev
        new_deferred_moves = deferred_move + reverse_move
        original_moves.deferred_move_ids |= new_deferred_moves
        (deferred_move + reverse_move)._post(soft=True)
        return {
            'name': _('Deferred Entry'),
            'type': 'ir.actions.act_window',
            'views': [(False, "tree"), (False, "form")],
            'domain': [('id', 'in', new_deferred_moves.ids)],
            'res_model': 'account.move',
            'target': 'current',
        }

    def _get_lines(self, options, filter_already_generated=False):
        self.env['account.move.line'].check_access_rights('read')
        query_params = {
            'company_id': self.env.company.id,
            'account_types': ('expense', 'expense_depreciation', 'expense_direct_cost') if self._get_deferred_report_type() == 'expense' else ('income', 'income_other'),
            'date_from': options['date']['date_from'],
            'date_to': options['date']['date_to'],
        }
        move_filter = f"""AND move.state {"!= 'cancel'" if options.get('all_entries', False) else "= 'posted'"}"""
        show_already_generated = "TRUE OR" if not filter_already_generated else ""
        max_deferred_date = """
            (
                SELECT MAX(def_move.date)
                  FROM account_move_deferred_rel rel
                  JOIN account_move def_move ON def_move.id = rel.deferred_move_id
                 WHERE rel.original_move_id = move.id
            )
        """

        sql = f"""
            SELECT line.id AS line_id,
                   line.account_id AS account_id,
                   line.partner_id AS partner_id,
                   line.name AS line_name,
                   line.deferred_start_date AS deferred_start_date,
                   line.deferred_end_date AS deferred_end_date,
                   line.deferred_end_date - line.deferred_start_date AS diff_days,
                   line.balance AS balance,
                   move.id as move_id,
                   move.name AS move_name,
                   account.name AS account_name
              FROM account_move_line line
         LEFT JOIN account_move move ON line.move_id = move.id
         LEFT JOIN account_account account ON line.account_id = account.id
             WHERE line.company_id = %(company_id)s
               AND line.deferred_start_date IS NOT NULL
               AND line.deferred_end_date IS NOT NULL
               AND
               (
                    {show_already_generated}
                    {max_deferred_date} IS NULL
                    OR {max_deferred_date} < %(date_to)s
               )
               AND move.date <= %(date_to)s
               AND
               (
                   (
                       %(date_from)s <= line.deferred_start_date
                       AND line.deferred_start_date <= %(date_to)s
                   ) OR (
                       line.deferred_start_date <= %(date_from)s
                       AND %(date_from)s <= line.deferred_end_date
                   )
               )
               AND account.account_type IN %(account_types)s
               {move_filter}
          ORDER BY line.deferred_start_date, line.id;
        """
        self._cr.execute(sql, query_params)
        results = self._cr.dictfetchall()
        return results

    @api.model
    def _group_deferred_amounts_by_account(self, deferred_amounts_by_line, periods, is_reverse):
        """
        Groups the deferred amounts by account and computes the totals for each account for each period.
        And the total for all accounts for each period.
        E.g. (where period1 = (date1, date2), period2 = (date2, date3), ...)
        [
            {'account': account1, 'amount_account': 600, 'period_1': 200, 'period_2': 400},
            {'account': account2, 'amount_account': 700, 'period_1': 300, 'period_2': 400},
        ], {'amount_total': 1300, 'period_1': 500, 'period_2': 800}
        """
        deferred_amounts_by_line = groupby(deferred_amounts_by_line, key=lambda x: x['account_id'])
        totals_per_account = []  # List of dict with keys: account, total, before, current, later
        totals_all_accounts = {period: 0 for period in periods + ['amount_total']}
        sign = 1 if is_reverse else -1
        for account_id, lines_per_account in deferred_amounts_by_line:
            lines_per_account = list(lines_per_account)
            totals_account = {
                'account': self.env['account.account'].browse(account_id) if isinstance(account_id, int) else account_id,
                'amount_account': sign * sum(line['balance'] for line in lines_per_account),
            }
            totals_all_accounts['amount_total'] += totals_account['amount_account']
            for period in periods:
                totals_account[period] = sign * sum(line[period] for line in lines_per_account)
                totals_all_accounts[period] += self.env.company.currency_id.round(totals_account[period])
            totals_per_account.append(totals_account)
        return totals_per_account, totals_all_accounts

    @api.model
    def _get_deferred_lines(self, lines, deferred_account, period, is_reverse, ref):
        """
        Returns a list of Command objects to create the deferred lines of a single given period.
        And the move_ids of the original lines that created these deferred
        (to keep track of the original invoice in the deferred entries).
        """
        if not deferred_account:
            raise UserError(_("Please set the deferred accounts in the accounting settings."))
        deferred_amounts_by_line, original_move_ids = self.env['account.move']._get_deferred_amounts_by_line(lines, [period])
        deferred_amounts_by_account, deferred_amounts_totals = self._group_deferred_amounts_by_account(deferred_amounts_by_line, [period], is_reverse)
        if deferred_amounts_totals['amount_total'] == deferred_amounts_totals[period]:
            return [], set()
        lines = [
            Command.create({
                'account_id': account.id,
                'debit': amount1 if is_reverse else amount2,
                'credit': amount1 if not is_reverse else amount2,
                'name': ref,
            })
            for line in deferred_amounts_by_account
            for account, amount1, amount2 in (
                (line['account'], 0, line['amount_account']),
                (line['account'], line[period], 0),
            )
        ]
        deferred_line = [
            Command.create({
                'account_id': deferred_account.id,
                'debit': deferred_amounts_totals['amount_total'] - deferred_amounts_totals[period] if is_reverse else 0,
                'credit': deferred_amounts_totals['amount_total'] - deferred_amounts_totals[period] if not is_reverse else 0,
                'name': ref,
            })
        ]
        return lines + deferred_line, original_move_ids

    def _dynamic_lines_generator(self, report, options, all_column_groups_expression_totals, warnings=None):
        def get_columns(totals):
            return [
                report._build_column_dict(
                    options=options,
                    no_format=totals[period],
                    figure_type='monetary',
                    expression_label='total',
                    currency=self.env.company.currency_id,
                )
                for period in periods
            ]

        if warnings is not None:
            already_posted = (
                self.env.company.generate_deferred_entries_method == 'manual'
                and self.env['account.move.line'].search_count([
                    ('company_id', '=', self.env.company.id),
                    ('deferred_start_date', '!=', False),
                    ('deferred_end_date', '!=', False),
                    ('move_id.state', '=', 'posted') if not options.get('all_entries', False) else ('move_id.state', '!=', 'cancel'),
                    ('move_id.deferred_move_ids', '!=', False),
                    ('move_id.deferred_move_ids.date', '>=', options['date']['date_to']),
                ])
            )
            if already_posted:
                warnings['account_reports.deferred_report_warning_already_posted'] = {'alert_type': 'warning'}

        lines = self._get_lines(options)
        periods = [
            (fields.Date.from_string(column['date_from']), fields.Date.from_string(column['date_to']))
            for column in options['columns']
        ]
        deferred_amounts_by_line, dummy = self.env['account.move']._get_deferred_amounts_by_line(lines, periods)
        totals_per_account, totals_all_accounts = self._group_deferred_amounts_by_account(deferred_amounts_by_line, periods, self._get_deferred_report_type() == 'expense')

        report_lines = []

        for totals_account in totals_per_account:
            report_lines.append((0, {
                'id': report._get_generic_line_id('account.account', totals_account['account'].id),
                'name': f"{totals_account['account'].code} {totals_account['account'].name}",
                'level': 1,
                'columns': get_columns(totals_account),
            }))
        if totals_per_account:
            report_lines.append((0, {
                'id': report._get_generic_line_id(None, None, markup='total'),
                'name': 'TOTALS',
                'level': 1,
                'columns': get_columns(totals_all_accounts),
            }))
        return report_lines


class DeferredExpenseCustomHandler(models.AbstractModel):
    _name = 'account.deferred.expense.report.handler'
    _inherit = 'account.deferred.report.handler'
    _description = 'Deferred Expense Custom Handler'

    def _get_deferred_report_type(self):
        return 'expense'


class DeferredRevenueCustomHandler(models.AbstractModel):
    _name = 'account.deferred.revenue.report.handler'
    _inherit = 'account.deferred.report.handler'
    _description = 'Deferred Revenue Custom Handler'

    def _get_deferred_report_type(self):
        return 'revenue'
