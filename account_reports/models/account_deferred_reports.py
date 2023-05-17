# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, fields, _
from odoo.exceptions import UserError


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
        lines = self._get_lines(options)
        if not lines:
            raise UserError(_("No entry to generate."))
        period = (fields.Date.from_string('1900-01-01'), fields.Date.from_string(options['date']['date_to']))
        deferred_account = self.env.company.deferred_expense_account_id if self._get_deferred_report_type() == 'expense' else self.env.company.deferred_revenue_account_id
        move_lines, original_move_ids = self.env['account.move']._get_deferred_lines(lines, deferred_account, period, self._get_deferred_report_type() == 'expense')

        original_moves = self.env['account.move'].browse(original_move_ids)
        original_moves.deferred_move_ids += self.env['account.move']._get_deferred_move_and_reverse(
            move_lines, original_move_ids, self.env.company.deferred_journal_id, period[1]
        )
        return {
            'name': _('Deferred Entry'),
            'type': 'ir.actions.act_window',
            'views': [(False, "tree"), (False, "form")],
            'domain': [('id', 'in', original_moves.deferred_move_ids.ids)],
            'res_model': 'account.move',
            'target': 'current',
        }

    def _get_lines(self, options):
        self.env['account.move.line'].check_access_rights('read')
        query_params = {
            'company_id': self.env.company.id,
            'account_types': ('expense', 'expense_depreciation', 'expense_direct_cost') if self._get_deferred_report_type() == 'expense' else ('income', 'income_other'),
            'date_from': options['date']['date_from'],
            'date_to': options['date']['date_to'],
        }
        move_filter = f"""AND move.state {"!= 'cancel'" if options.get('all_entries', False) else "= 'posted'"}"""

        sql = f"""
            SELECT line.id AS line_id,
                   move.id as move_id, 
                   line.account_id AS account_id,
                   line.partner_id AS partner_id,
                   line.name AS line_name,
                   move.name AS move_name,
                   account.name AS account_name,
                   line.deferred_start_date AS deferred_start_date,
                   line.deferred_end_date AS deferred_end_date,
                   line.deferred_end_date - line.deferred_start_date AS diff_days,
                   line.balance AS balance
              FROM account_move_line line
         LEFT JOIN account_move move ON line.move_id = move.id
         LEFT JOIN account_account account ON line.account_id = account.id
             WHERE line.company_id = %(company_id)s
               AND line.deferred_start_date IS NOT NULL
               AND line.deferred_end_date IS NOT NULL
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

    def _dynamic_lines_generator(self, report, options, all_column_groups_expression_totals):
        def get_columns(totals):
            return [
                {
                    'no_format': totals[period],
                    'name': report.format_value(totals[period], currency=self.env.company.currency_id, figure_type='monetary_without_symbol'),
                    'class': 'number'
                }
                for period in periods
            ]

        lines = self._get_lines(options)
        periods = [
            (fields.Date.from_string(column['date_from']), fields.Date.from_string(column['date_to']))
            for column in options['columns']
        ]
        deferred_amounts_by_line, dummy = self.env['account.move']._get_deferred_amounts_by_line(lines, periods)
        totals_per_account, totals_all_accounts = self.env['account.move']._group_deferred_amounts_by_account(deferred_amounts_by_line, periods, self._get_deferred_report_type() == 'expense')

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
                'class': 'total',
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
