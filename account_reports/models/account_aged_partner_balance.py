# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, fields, _
from odoo.tools.misc import format_date
from dateutil.relativedelta import relativedelta
from collections import OrderedDict


class ReportAccountAgedPartner(models.AbstractModel):
    _name = "account.aged.partner"
    _description = "Aged Partner Balances"
    _inherit = 'account.report'

    filter_date = {'mode': 'single', 'filter': 'today'}
    filter_unfold_all = False
    filter_partner = True
    order_selected_column = {'default': 0}

    @api.model
    def _get_templates(self):
        # OVERRIDE
        templates = super(ReportAccountAgedPartner, self)._get_templates()
        templates['main_template'] = 'account_reports.template_aged_partner_balance_report'
        return templates

    ####################################################
    # OPTIONS
    ####################################################

    @api.model
    def _get_options_domain(self, options):
        # OVERRIDE
        domain = super(ReportAccountAgedPartner, self)._get_options_domain(options)
        domain.append(('account_id.internal_type', '=', options['filter_account_type']))
        return domain

    ####################################################
    # QUERIES
    ####################################################

    @api.model
    def _get_query_period_table(self, options):
        ''' Compute the periods to handle in the report.
        E.g. Suppose date = '2019-01-09', the computed periods will be:

        Name                | Start         | Stop
        --------------------------------------------
        As of 2019-01-09    | 2019-01-09    |
        1 - 30              | 2018-12-10    | 2019-01-08
        31 - 60             | 2018-11-10    | 2018-12-09
        61 - 90             | 2018-10-11    | 2018-11-09
        91 - 120            | 2018-09-11    | 2018-10-10
        Older               |               | 2018-09-10

        Then, return the values as an sql floating table to use it directly in queries.

        :param options: The report options.
        :return: A floating sql query representing the report's periods.
        '''
        def minus_days(date_obj, days):
            return fields.Date.to_string(date_obj - relativedelta(days=days))

        date_str = options['date']['date_to']
        date = fields.Date.from_string(date_str)
        period_values = [
            (False,                  date_str),
            (minus_days(date, 1),    minus_days(date, 30)),
            (minus_days(date, 31),   minus_days(date, 60)),
            (minus_days(date, 61),   minus_days(date, 90)),
            (minus_days(date, 91),   minus_days(date, 120)),
            (minus_days(date, 121),  False),
        ]

        period_table = ','.join("(%s, %s, %s)" % (
            period[0] and "'%s'" % period[0] or 'NULL',
            period[1] and "'%s'" % period[1] or 'NULL',
            i,
        ) for i, period in enumerate(period_values))
        return '(VALUES %s) AS period_table(date_start, date_stop, period_index)' % period_table

    @api.model
    def _do_query_amls(self, options, expanded_partner_id=None):
        ''' Fetch the unfolded account.move.lines.
        :param options:             The report options.
        :param expanded_partner_id: The res.partner record's id corresponding to the expanded line.
        :return:                    A map partner_id => fetched rows.
        '''
        unfold_all = options.get('unfold_all') or (self._context.get('print_mode') and not options['unfolded_lines'])
        sign = 1 if options['filter_account_type'] == 'receivable' else -1

        groupby_partner_aml = OrderedDict()

        if expanded_partner_id:
            domain = [('partner_id', '=', expanded_partner_id)]
        elif unfold_all:
            domain = []
        elif options['unfolded_lines']:
            domain = [('partner_id', 'in', [int(line[8:]) for line in options['unfolded_lines']])]
        else:
            return groupby_partner_aml

        tables, where_clause, params = self._query_get(options, domain=domain)
        ct_query = self._get_query_currency_table(options)
        period_query = self._get_query_period_table(options)

        # ===================================================================================================
        # 1) Fetch the balance for each period.
        # ===================================================================================================

        query = '''
            SELECT
                account_move_line.id,
                account_move_line.partner_id,
                account_move_line.payment_id,
                account_move_line.date,
                account_move_line.date_maturity,
                account_move_line.expected_pay_date,
                account_move_line__move_id.type AS move_type,
                account_move_line__move_id.name AS move_name,
                journal.code AS journal_code,
                account.name AS account_name,
                account.code AS account_code,
                period_table.period_index,
                ROUND(account_move_line.balance * currency_table.rate, currency_table.precision) AS balance
            FROM ''' + tables + '''
            JOIN ''' + ct_query + ''' ON currency_table.company_id = account_move_line.company_id
            JOIN ''' + period_query + ''' ON
                (
                    period_table.date_start IS NULL 
                    OR 
                    COALESCE(account_move_line.date_maturity, account_move_line.date) <= DATE(period_table.date_start)
                )
                AND
                (
                    period_table.date_stop IS NULL 
                    OR 
                    COALESCE(account_move_line.date_maturity, account_move_line.date) >= DATE(period_table.date_stop)                  
                )
            JOIN account_journal journal ON journal.id = account_move_line.journal_id
            JOIN account_account account ON account.id = account_move_line.account_id
            WHERE ''' + where_clause + ''' AND NOT account_move_line.reconciled
            ORDER BY account_move_line.partner_id, COALESCE(account_move_line.date_maturity, account_move_line.date)
        '''

        seen_aml_ids = set()

        self._cr.execute(query, params)
        for res in self._cr.dictfetchall():
            seen_aml_ids.add(res['id'])
            groupby_partner_aml.setdefault(res['partner_id'], OrderedDict())
            res['period_amounts'] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
            res['period_amounts'][res['period_index']] = sign * res['balance']
            groupby_partner_aml[res['partner_id']][res['id']] = res

        # ===================================================================================================
        # 2) Fetch the reconciliation for each period and subtract them from the balance to compute
        # the amount due at the report's date.
        # ===================================================================================================

        if seen_aml_ids:
            query = '''
                SELECT
                    part.debit_move_id AS id,
                    account_move_line.partner_id,
                    period_table.period_index,
                    SUM(ROUND(part.amount * currency_table.rate, currency_table.precision)) AS amount
                FROM account_partial_reconcile part
                JOIN account_move_line ON account_move_line.id = part.debit_move_id
                JOIN ''' + ct_query + ''' ON currency_table.company_id = part.company_id
                JOIN ''' + period_query + ''' ON
                    (
                        period_table.date_start IS NULL 
                        OR 
                        COALESCE(account_move_line.date_maturity, account_move_line.date) <= DATE(period_table.date_start)
                    )
                    AND
                    (
                        period_table.date_stop IS NULL 
                        OR 
                        COALESCE(account_move_line.date_maturity, account_move_line.date) >= DATE(period_table.date_stop)
                    )
                WHERE part.debit_move_id IN %s AND part.max_date <= %s
                GROUP BY part.debit_move_id, account_move_line.partner_id, period_table.period_index
                
                UNION ALL
                
                SELECT
                    part.credit_move_id AS id,
                    account_move_line.partner_id,
                    period_table.period_index,
                    SUM(ROUND(-part.amount * currency_table.rate, currency_table.precision)) AS amount
                FROM account_partial_reconcile part
                JOIN account_move_line ON account_move_line.id = part.credit_move_id
                JOIN ''' + ct_query + ''' ON currency_table.company_id = part.company_id
                JOIN ''' + period_query + ''' ON
                    (
                        period_table.date_start IS NULL 
                        OR 
                        COALESCE(account_move_line.date_maturity, account_move_line.date) <= DATE(period_table.date_start)
                    )
                    AND
                    (
                        period_table.date_stop IS NULL 
                        OR 
                        COALESCE(account_move_line.date_maturity, account_move_line.date) >= DATE(period_table.date_stop)
                    )
                WHERE part.credit_move_id IN %s AND part.max_date <= %s
                GROUP BY part.credit_move_id, account_move_line.partner_id, period_table.period_index
            '''

            self._cr.execute(query, [tuple(seen_aml_ids), options['date']['date_to']] * 2)
            for res in self._cr.dictfetchall():
                groupby_partner_aml[res['partner_id']][res['id']]['period_amounts'][res['period_index']] -= sign * res['amount']

        return dict((k, list(v.values())) for k, v in groupby_partner_aml.items())

    @api.model
    def _do_query_groupby(self, options, expanded_partner_id=None):
        ''' Fetch the account.move.lines grouped by partners.
        :param options:             The report options.
        :param expanded_partner_id: The res.partner record's id corresponding to the expanded line.
        :return:                    A map partner_id => fetched rows.
        '''
        sign = 1 if options['filter_account_type'] == 'receivable' else -1

        if expanded_partner_id:
            domain = [('partner_id', '=', expanded_partner_id)]
        else:
            domain = []

        groupby_partner = {}

        tables, where_clause, params = self._query_get(options, domain=domain)
        ct_query = self._get_query_currency_table(options)
        period_query = self._get_query_period_table(options)

        # ===================================================================================================
        # 1) Fetch the balance for each period.
        # ===================================================================================================

        query = '''
            SELECT
                partner.id AS partner_id,
                partner.name AS partner_name,
                COALESCE(trust_property.value_text, 'normal') AS partner_trust,
                SUM(CASE WHEN period_table.period_index = 0 
                    THEN ROUND(account_move_line.balance * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period0,
                SUM(CASE WHEN period_table.period_index = 1 
                    THEN ROUND(account_move_line.balance * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period1,
                SUM(CASE WHEN period_table.period_index = 2 
                    THEN ROUND(account_move_line.balance * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period2,
                SUM(CASE WHEN period_table.period_index = 3 
                    THEN ROUND(account_move_line.balance * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period3,
                SUM(CASE WHEN period_table.period_index = 4 
                    THEN ROUND(account_move_line.balance * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period4,
                SUM(CASE WHEN period_table.period_index = 5
                    THEN ROUND(account_move_line.balance * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period5
            FROM ''' + tables + '''
            JOIN ''' + ct_query + ''' ON currency_table.company_id = account_move_line.company_id
            JOIN ''' + period_query + ''' ON 
                (
                    period_table.date_start IS NULL 
                    OR 
                    COALESCE(account_move_line.date_maturity, account_move_line.date) <= DATE(period_table.date_start)
                )
                AND
                (
                    period_table.date_stop IS NULL 
                    OR 
                    COALESCE(account_move_line.date_maturity, account_move_line.date) >= DATE(period_table.date_stop)                  
                )
            LEFT JOIN res_partner partner ON partner.id = account_move_line.partner_id
            LEFT JOIN ir_property trust_property ON (
                trust_property.res_id = 'res.partner,'|| partner.id
                AND
                trust_property.name = 'trust'
                AND 
                trust_property.company_id = %s
            )
            WHERE ''' + where_clause + ''' AND NOT account_move_line.reconciled
            GROUP BY partner.id, partner.name, partner_trust
            ORDER BY UPPER(partner.name)
        '''

        self._cr.execute(query, [self.env.company.id] + params)
        for res in self._cr.dictfetchall():
            res['period0'] *= sign
            res['period1'] *= sign
            res['period2'] *= sign
            res['period3'] *= sign
            res['period4'] *= sign
            res['period5'] *= sign
            groupby_partner[res['partner_id']] = res

        # ===================================================================================================
        # 2) Fetch the reconciliation for each period and subtract them from the balance to compute
        # the amount due at the report's date.
        # ===================================================================================================

        query = '''
            SELECT
                account_move_line.partner_id AS partner_id,
                SUM(CASE WHEN period_table.period_index = 0 
                    THEN ROUND(part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period0,
                SUM(CASE WHEN period_table.period_index = 1 
                    THEN ROUND(part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period1,
                SUM(CASE WHEN period_table.period_index = 2 
                    THEN ROUND(part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period2,
                SUM(CASE WHEN period_table.period_index = 3 
                    THEN ROUND(part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period3,
                SUM(CASE WHEN period_table.period_index = 4 
                    THEN ROUND(part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period4,
                SUM(CASE WHEN period_table.period_index = 5
                    THEN ROUND(part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period5
            FROM ''' + tables + '''
            JOIN account_partial_reconcile part ON part.debit_move_id = account_move_line.id
            JOIN ''' + ct_query + ''' ON currency_table.company_id = account_move_line.company_id
            JOIN ''' + period_query + ''' ON 
                (
                    period_table.date_start IS NULL 
                    OR 
                    COALESCE(account_move_line.date_maturity, account_move_line.date) <= DATE(period_table.date_start)
                )
                AND
                (
                    period_table.date_stop IS NULL 
                    OR 
                    COALESCE(account_move_line.date_maturity, account_move_line.date) >= DATE(period_table.date_stop)                  
                )
            WHERE ''' + where_clause + ''' AND NOT account_move_line.reconciled AND part.max_date <= %s
            GROUP BY account_move_line.partner_id
            
            UNION ALL
            
            SELECT
                account_move_line.partner_id AS partner_id,
                SUM(CASE WHEN period_table.period_index = 0 
                    THEN ROUND(-part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period0,
                SUM(CASE WHEN period_table.period_index = 1 
                    THEN ROUND(-part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period1,
                SUM(CASE WHEN period_table.period_index = 2 
                    THEN ROUND(-part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period2,
                SUM(CASE WHEN period_table.period_index = 3 
                    THEN ROUND(-part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period3,
                SUM(CASE WHEN period_table.period_index = 4 
                    THEN ROUND(-part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period4,
                SUM(CASE WHEN period_table.period_index = 5
                    THEN ROUND(-part.amount * currency_table.rate, currency_table.precision) 
                    ELSE 0 END) AS period5
            FROM ''' + tables + '''
            JOIN account_partial_reconcile part ON part.credit_move_id = account_move_line.id
            JOIN ''' + ct_query + ''' ON currency_table.company_id = account_move_line.company_id
            JOIN ''' + period_query + ''' ON 
                (
                    period_table.date_start IS NULL 
                    OR 
                    COALESCE(account_move_line.date_maturity, account_move_line.date) <= DATE(period_table.date_start)
                )
                AND
                (
                    period_table.date_stop IS NULL 
                    OR 
                    COALESCE(account_move_line.date_maturity, account_move_line.date) >= DATE(period_table.date_stop)                  
                )
            WHERE ''' + where_clause + ''' AND NOT account_move_line.reconciled AND part.max_date <= %s
            GROUP BY account_move_line.partner_id
        '''

        self._cr.execute(query, (params + [options['date']['date_to']]) * 2)
        for res in self._cr.dictfetchall():
            groupby_partner[res['partner_id']]['period0'] -= sign * res['period0']
            groupby_partner[res['partner_id']]['period1'] -= sign * res['period1']
            groupby_partner[res['partner_id']]['period2'] -= sign * res['period2']
            groupby_partner[res['partner_id']]['period3'] -= sign * res['period3']
            groupby_partner[res['partner_id']]['period4'] -= sign * res['period4']
            groupby_partner[res['partner_id']]['period5'] -= sign * res['period5']

        # ===================================================================================================
        # 3) Fetch the unfolded lines.
        # ===================================================================================================

        for partner_id, aml_rows in self._do_query_amls(options, expanded_partner_id=expanded_partner_id).items():
            groupby_partner[partner_id]['aml_lines'] = aml_rows

        return list(groupby_partner.values())

    ####################################################
    # COLUMNS/LINES
    ####################################################

    @api.model
    def _get_report_partner_line(self, options, row):
        unfold_all = self._context.get('print_mode') and not options.get('unfolded_lines')

        total = row['period0'] + row['period1'] + row['period2'] + row['period3'] + row['period4'] + row['period5']
        columns = [
            {'name': self.format_value(row['period0']), 'no_format': row['period0'], 'class': 'number'},
            {'name': self.format_value(row['period1']), 'no_format': row['period1'], 'class': 'number'},
            {'name': self.format_value(row['period2']), 'no_format': row['period2'], 'class': 'number'},
            {'name': self.format_value(row['period3']), 'no_format': row['period3'], 'class': 'number'},
            {'name': self.format_value(row['period4']), 'no_format': row['period4'], 'class': 'number'},
            {'name': self.format_value(row['period5']), 'no_format': row['period5'], 'class': 'number'},
            {'name': self.format_value(total), 'no_format': total, 'class': 'number'},
        ]
        return {
            'id': 'partner_%s' % row['partner_id'],
            'partner_id': row['partner_id'],
            'name': row['partner_name'][:128] if row['partner_name'] else _('Unknown Partner'),
            'columns': columns,
            'level': 2,
            'trust': row['partner_trust'],
            'unfoldable': True,
            'unfolded': 'partner_%s' % row['partner_id'] in options['unfolded_lines'] or unfold_all,
            'colspan': 5,
        }

    @api.model
    def _get_report_move_line(self, options, row):
        if row['payment_id']:
            caret_type = 'account.payment'
        else:
            caret_type = 'account.move'

        columns = [
            {'name': format_date(self.env, row['date_maturity'] or row['date']), 'class': 'date'},
            {'name': row['journal_code']},
            {'name': '%s %s' % (row['account_code'], row['account_name'])},
            {'name': format_date(self.env, row['expected_pay_date']), 'class': 'date'},
        ]
        columns += [{'name': self.format_value(amount, blank_if_zero=True), 'no_format': amount, 'class': 'number'} for amount in row['period_amounts']]
        columns.append({'name': '', 'no_format': 0.0})
        return {
            'id': row['id'],
            'parent_id': 'partner_%s' % row['partner_id'],
            'name': row['move_name'],
            'columns': columns,
            'caret_options': caret_type,
            'level': 4,
        }

    @api.model
    def _get_report_total_line(self, options, totals):
        columns = []
        final_total = 0.0
        for total in totals:
            columns.append({'name': self.format_value(total), 'no_format': total})
            final_total += total
        columns.append({'name': self.format_value(final_total), 'no_format': final_total})
        return {
            'id': 'total',
            'class': 'total',
            'name': _('Total'),
            'columns': columns,
            'colspan': 5,
            'level': 2,
        }

    @api.model
    def _get_columns_name(self, options):
        columns = [
            {},
            {'name': _("Due Date"), 'class': 'date', 'style': 'white-space:nowrap;'},
            {'name': _("Journal"), 'class': '', 'style': 'text-align:center; white-space:nowrap;'},
            {'name': _("Account"), 'class': '', 'style': 'text-align:center; white-space:nowrap;'},
            {'name': _("Exp. Date"), 'class': 'date', 'style': 'white-space:nowrap;'},
            {'name': _("As of: %s") % format_date(self.env, options['date']['date_to']), 'class': 'number sortable', 'style': 'white-space:nowrap;'},
            {'name': _("1 - 30"), 'class': 'number sortable', 'style': 'white-space:nowrap;'},
            {'name': _("31 - 60"), 'class': 'number sortable', 'style': 'white-space:nowrap;'},
            {'name': _("61 - 90"), 'class': 'number sortable', 'style': 'white-space:nowrap;'},
            {'name': _("91 - 120"), 'class': 'number sortable', 'style': 'white-space:nowrap;'},
            {'name': _("Older"), 'class': 'number sortable', 'style': 'white-space:nowrap;'},
            {'name': _("Total"), 'class': 'number sortable', 'style': 'white-space:nowrap;'},
        ]
        return columns

    @api.model
    def _get_lines(self, options, line_id=None):
        expanded_partner_id = int(line_id.split('_')[-1]) if line_id else None
        lines = []
        totals = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        for partner_row in self._do_query_groupby(options, expanded_partner_id=expanded_partner_id):
            totals[0] += partner_row['period0']
            totals[1] += partner_row['period1']
            totals[2] += partner_row['period2']
            totals[3] += partner_row['period3']
            totals[4] += partner_row['period4']
            totals[5] += partner_row['period5']
            lines.append(self._get_report_partner_line(options, partner_row))
            lines += [self._get_report_move_line(options, aml_row) for aml_row in partner_row.pop('aml_lines', [])]

        if not line_id:
            lines.append(self._get_report_total_line(options, totals))

        return lines


class ReportAccountAgedReceivable(models.AbstractModel):
    _name = "account.aged.receivable"
    _description = "Aged Receivable"
    _inherit = "account.aged.partner"

    @api.model
    def _get_options(self, previous_options=None):
        # OVERRIDE
        options = super(ReportAccountAgedReceivable, self)._get_options(previous_options=previous_options)
        options['filter_account_type'] = 'receivable'
        return options

    @api.model
    def _get_report_name(self):
        return _("Aged Receivable")

    @api.model
    def _get_templates(self):
        # OVERRIDE
        templates = super(ReportAccountAgedReceivable, self)._get_templates()
        templates['line_template'] = 'account_reports.line_template_aged_receivable_report'
        return templates


class ReportAccountAgedPayable(models.AbstractModel):
    _name = "account.aged.payable"
    _description = "Aged Payable"
    _inherit = "account.aged.partner"

    @api.model
    def _get_options(self, previous_options=None):
        # OVERRIDE
        options = super(ReportAccountAgedPayable, self)._get_options(previous_options=previous_options)
        options['filter_account_type'] = 'payable'
        return options

    @api.model
    def _get_report_name(self):
        return _("Aged Payable")

    @api.model
    def _get_templates(self):
        # OVERRIDE
        templates = super(ReportAccountAgedPayable, self)._get_templates()
        templates['line_template'] = 'account_reports.line_template_aged_payable_report'
        return templates
