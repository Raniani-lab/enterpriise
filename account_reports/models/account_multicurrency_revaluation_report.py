# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, _
from odoo.tools import float_is_zero


class MulticurrencyRevaluationReport(models.AbstractModel):
    _inherit = 'account.report'
    _name = 'account.multicurrency.revaluation.report'
    _description = 'Multicurrency Revaluation Report'

    filter_multi_company = None
    filter_date = {'date_from': '', 'date_to': '', 'filter': 'this_month', 'mode': 'single'}
    filter_all_entries = False

    # TEMPLATING
    @api.model
    def _get_report_name(self):
        return _('Unrealized Currency Gains/Losses')

    def _get_columns_name(self, options):
        columns_header = [
            {},
            {'name': _('Balance in foreign currency'), 'class': 'number'},
            {'name': _('Balance at operation rate'), 'class': 'number'},
            {'name': _('Balance at current rate'), 'class': 'number'},
            {'name': _('Adjustment'), 'class': 'number'},
        ]
        return columns_header

    @api.model
    def _get_templates(self):
        templates = super(MulticurrencyRevaluationReport, self)._get_templates()
        templates['line_template'] = 'account_reports.line_template_multicurrency_report'
        templates['main_template'] = 'account_reports.template_multicurrency_report'
        return templates

    def _get_reports_buttons(self):
        r = super(MulticurrencyRevaluationReport, self)._get_reports_buttons()
        r.append({'name': _('Adjustment Entry'), 'action': 'view_revaluation_wizard'})
        return r

    def _get_options(self, previous_options=None):
        options = super(MulticurrencyRevaluationReport, self)._get_options(previous_options)
        rates = self.env['res.currency'].search([('active', '=', True)])._get_rates(self.env.company, options.get('date').get('date_to'))
        for key in rates.keys():  # normalize the rates to the company's currency
            rates[key] /= rates[self.env.company.currency_id.id]
        options['currency_rates'] = {
            str(currency_id.id): {
                'currency_id': currency_id.id,
                'currency_name': currency_id.name,
                'currency_main': self.env.company.currency_id.name,
                'rate': (rates[currency_id.id]
                         if not (previous_options or {}).get('currency_rates', {}).get(str(currency_id.id), {}).get('rate') else
                         float(previous_options['currency_rates'][str(currency_id.id)]['rate'])),
            } for currency_id in self.env['res.currency'].search([('active', '=', True)])
        }
        options['company_currency'] = options['currency_rates'].pop(str(self.env.company.currency_id.id))
        options['custom_rate'] = any(
            not float_is_zero(cr['rate'] - rates[cr['currency_id']], 6)
            for cr in options['currency_rates'].values()
        )
        options['warning_multicompany'] = len(self.env.companies) > 1
        return options

    # GET LINES VALUES
    def _get_sql(self, exclude, options):
        query = """
            SELECT SUM(amount_currency) AS amount_currency,
                   SUM(balance) AS balance,
                   account_id,
                   currency_id,
                   EXISTS (SELECT * FROM account_account_exclude_res_currency_provision WHERE account_account_id = account_id AND res_currency_id = currency_id) AS exclude
            FROM (
                SELECT aml.amount_currency,
                aml.balance,
                aml.account_id,
                aml.currency_id
                FROM account_move_line aml
                JOIN account_move am ON aml.move_id = am.id
                JOIN account_account account ON aml.account_id = account.id
                WHERE aml.date <= %(date_to)s
                AND aml.company_id IN %(company_ids)s
                {all_entries}
                {exclude}
                AND (account.currency_id IS NOT NULL OR (account.internal_type IN ('receivable', 'payable') AND (aml.currency_id IS NOT NULL)))


                UNION ALL

                -- Add the lines without currency, i.e. payment in company currency for invoice in foreign currency
                SELECT -part.debit_amount_currency AS amount_currency,
                -part.amount AS balance,
                aml.account_id,
                part.debit_currency_id AS currency_id
                FROM account_move_line aml
                JOIN account_move am ON aml.move_id = am.id
                JOIN account_account account ON aml.account_id = account.id
                JOIN account_partial_reconcile part ON aml.id = part.debit_move_id
                WHERE part.max_date <= %(date_to)s
                AND aml.company_id IN %(company_ids)s
                {all_entries}
                {exclude}
                AND (account.currency_id IS NULL AND (account.internal_type IN ('receivable', 'payable') AND aml.currency_id IS NULL))

                UNION ALL

                -- Add the lines without currency, i.e. payment in company currency for invoice in foreign currency
                SELECT -part.credit_amount_currency AS amount_currency,
                -part.amount AS balance,
                aml.account_id,
                part.credit_currency_id AS currency_id
                FROM account_move_line aml
                JOIN account_move am ON aml.move_id = am.id
                JOIN account_account account ON aml.account_id = account.id
                JOIN account_partial_reconcile part ON aml.id = part.debit_move_id
                WHERE part.max_date <= %(date_to)s
                AND aml.company_id IN %(company_ids)s
                {all_entries}
                {exclude}
                AND (account.currency_id IS NULL AND (account.internal_type IN ('receivable', 'payable') AND aml.currency_id IS NULL))
            ) AS all_lines
            GROUP BY account_id, currency_id
        """.format(
            all_entries=not options['all_entries'] and "AND am.state != 'draft'" or "",
            exclude=exclude and "AND NOT EXISTS (SELECT * FROM account_account_exclude_res_currency_provision WHERE account_account_id = aml.account_id AND res_currency_id = aml.currency_id)" or ""
        )
        sql_params = {
            'date_to': options['date']['date_to'],
            'company_ids': tuple(self.env.company.ids)
        }
        return query, sql_params

    def _get_values(self, exclude, options):
        query, sql_params = self._get_sql(exclude, options)
        self.env.cr.execute(query, sql_params)
        return self.env.cr.dictfetchall()

    def _get_grouped_values(self, exclude, options):
        amls_grouped = self._get_values(exclude, options)
        line_dict = {}
        rates = {str(cur['currency_id']): cur['rate'] for cur in options['currency_rates'].values()}
        for group in amls_grouped:
            included = 1 - int(group['exclude'] or False)
            currency = group['currency_id']
            account = group['account_id']
            rate = rates[str(currency)]
            amounts = [group['amount_currency'], group['balance'], group['amount_currency'] / rate, group['amount_currency'] / rate - group['balance']]

            if included not in line_dict:
                line_dict[included] = {}
            if currency not in line_dict[included]:
                line_dict[included][currency] = {}
            if account not in line_dict[included][currency]:
                line_dict[included][currency][account] = [0] * len(amounts)

            for i in range(len(amounts)):
                line_dict[included][currency][account][i] += amounts[i]
        return line_dict

    @api.model
    def _get_lines(self, options, line_id=None):
        lines = []
        line_dict = self._get_grouped_values(exclude=False, options=options)
        for inc in sorted(line_dict, reverse=True):
            lines.append({
                'id': 'included{}'.format(inc),
                'name': _('Accounts to adjust') if inc else _('Excluded Accounts'),
                'unfoldable': False,
                'columns': [{}, {}, {}, {}],
                'level': 1,
                'class': 'no_print',
            })
            for cur in line_dict[inc]:
                currency = self.env['res.currency'].browse(cur)
                sum = [0, 0, 0, 0]
                cur_index = len(lines)
                lines.append({
                    'id': 'included{}_res.currency{}'.format(inc, cur),
                    'parent_id': 'included{}'.format(inc),
                    'currency_id': cur,
                    'name': '{for_cur} (1 {comp_cur} = {rate:.6} {for_cur})'.format(
                        for_cur=currency.display_name,
                        comp_cur=self.env.company.currency_id.display_name,
                        rate=float(options['currency_rates'][str(cur)]['rate']),
                    ),
                    'unfoldable': False,
                    'columns': [{}, {}, {}, {}],
                    'level': 2,
                    'class': ('' if inc else 'no_print'),
                })
                for acc in line_dict[inc][cur]:
                    account = self.env['account.account'].browse(acc)
                    for i in range(len(line_dict[inc][cur][acc])):
                        sum[i] += line_dict[inc][cur][acc][i]
                    lines.append({
                        'id': 'included{}_res.currency{}_account.account{}'.format(inc, cur, acc),
                        'account_id': str(acc),
                        'currency_id': str(cur),
                        'parent_id': 'included{}_res.currency{}'.format(inc, cur),
                        'name': account.display_name,
                        'unfoldable': False,
                        'columns': [{'name': self.format_value(line_dict[inc][cur][acc][0], currency)},
                                    {'name': self.format_value(line_dict[inc][cur][acc][1])},
                                    {'name': self.format_value(line_dict[inc][cur][acc][2])},
                                    {'name': self.format_value(line_dict[inc][cur][acc][3])},
                                    ],
                        'level': 3,
                        'class': '' if inc == 1 else 'no_print',
                        'caret_options': 'account.multicurrency',
                        'included': inc,
                    })
                lines[cur_index]['columns'] = [
                    {'name': self.format_value(sum[0], currency)},
                    {'name': self.format_value(sum[1])},
                    {'name': self.format_value(sum[2])},
                    {'name': self.format_value(sum[3])},
                ]
        return lines

    # ACTIONS
    def toggle_provision(self, options, params):
        account = self.env['account.account'].browse(int(params.get('account_id')))
        currency = self.env['res.currency'].browse(int(params.get('currency_id')))
        if currency in account.exclude_provision_currency_ids:
            account.exclude_provision_currency_ids -= currency
        else:
            account.exclude_provision_currency_ids += currency
        return {
            'type': 'ir.actions.client',
            'tag': 'reload',
        }

    def view_revaluation_wizard(self, context):
        form = self.env.ref('account_reports.view_account_multicurrency_revaluation_wizard', False)
        return {
            'name': _('Make Adjustment Entry'),
            'type': 'ir.actions.act_window',
            'res_model': "account.multicurrency.revaluation.wizard",
            'view_mode': "form",
            'view_id': form.id,
            'views': [(form.id, 'form')],
            'multi': "True",
            'target': "new",
            'context': context,
        }

    def view_currency(self, options, params=None):
        id = params.get('id')
        return {
            'type': 'ir.actions.act_window',
            'name': _('Currency Rates (%s)') % self.env['res.currency'].browse(id).display_name,
            'views': [(False, 'list')],
            'res_model': 'res.currency.rate',
            'context': {**self.env.context, **{'default_currency_id': id}},
            'domain': [('currency_id', '=', id)],
        }
