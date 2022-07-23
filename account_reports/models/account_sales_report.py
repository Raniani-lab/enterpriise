# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from collections import defaultdict

from odoo import _, api, fields, models


class ECSalesReport(models.Model):
    _inherit = 'account.report'

    def _custom_options_initializer_sales_report_no_country(self, options, previous_options=None):
        """
        Add the invoice lines search domain that is specific to the country.
        Typically, the taxes tag_ids relative to the country for the triangular, sale of goods or services
        :param dict options: Report options
        :param dict previous_options: Previous report options
        """
        self.ensure_one()
        self._sales_report_init_core_custom_options(options, previous_options)
        company_id = self.env.company.id
        options.update({
            'sales_report_taxes': {
                'goods': tuple(self.env['account.tax'].search([
                    ('company_id', '=', company_id),
                    ('amount', '=', 0.0),
                    ('amount_type', '=', 'percent'),
                ]).ids),
                'services': tuple(),
                'triangular': tuple(),
                'use_taxes_instead_of_tags': True,
                # We can't use tags as we don't have a country tax report correctly set, 'use_taxes_instead_of_tags'
                # should never be used outside this case
            }
        })

        self._init_options_journals(options, previous_options=previous_options, additional_journals_domain=[('type', '=', 'sale')])

    def _sales_report_init_core_custom_options(self, options, previous_options=None):
        """
        Add the invoice lines search domain that is common to all countries.
        :param dict options: Report options
        :param dict previous_options: Previous report options
        """
        self.ensure_one()
        country_ids = self.env['res.country'].search([
            ('code', 'in', tuple(self.sales_report_get_ec_country_codes(options)))
        ]).ids
        other_country_ids = tuple(set(country_ids) - {self.env.company.account_fiscal_country_id.id})
        options.setdefault('forced_domain', []).append(('partner_id.country_id', 'in', other_country_ids))
        default_tax_filter = [
            {'id': 'goods', 'name': _('Goods'), 'selected': True},
            {'id': 'triangular', 'name': _('Triangular'), 'selected': True},
            {'id': 'services', 'name': _('Services'), 'selected': True},
        ]
        options['ec_tax_filter_selection'] = (previous_options or {}).get('ec_tax_filter_selection', default_tax_filter)

    def _caret_options_initializer_sales_report(self):
        """
        Add custom caret option for the report to link to the partner and allow cleaner overrides.
        """
        return {
            'ec_sales': [
                {'name': _("View Partner"), 'action': 'caret_option_open_record_form'}
            ],
        }

    def _dynamic_lines_generator_sales_report(self, options, all_column_groups_expression_totals):
        """
        Generate the dynamic lines for the report in a vertical style (one line per tax per partner).
        """
        self.ensure_one()

        lines = []
        totals_by_column_group = {
            column_group_key: {
                'balance': 0.0,
                'goods': 0.0,
                'triangular': 0.0,
                'services': 0.0,
                'vat_number': '',
                'country_code': '',
                'sales_type_code': '',
            }
            for column_group_key in options['column_groups']
        }

        operation_categories = options['sales_report_taxes'].get('operation_category', {})
        ec_tax_filter_selection = {v.get('id'): v.get('selected') for v in options.get('ec_tax_filter_selection', [])}
        for partner, results in self._sales_report_query_partners(options):
            for tax_ec_category in ('goods', 'triangular', 'services'):
                if not ec_tax_filter_selection[tax_ec_category]:
                    # Skip the line if the tax is not selected
                    continue
                partner_values = defaultdict(dict)
                country_specific_code = operation_categories.get(tax_ec_category)
                has_found_a_line = False
                for col_grp_key in options['column_groups']:
                    partner_sum = results.get(col_grp_key, {})
                    partner_values[col_grp_key]['vat_number'] = partner_sum.get('vat_number', 'UNKNOWN')
                    partner_values[col_grp_key]['country_code'] = partner_sum.get('country_code', 'UNKNOWN')
                    partner_values[col_grp_key]['sales_type_code'] = []
                    partner_values[col_grp_key]['balance'] = 0.0
                    for i, operation_id in enumerate(partner_sum.get('tax_element_id', [])):
                        if operation_id in options['sales_report_taxes'][tax_ec_category]:
                            has_found_a_line = True
                            partner_values[col_grp_key]['balance'] += partner_sum.get(tax_ec_category, 0.0)
                            totals_by_column_group[col_grp_key]['balance'] += partner_sum.get(tax_ec_category, 0.0)
                            partner_values[col_grp_key]['sales_type_code'] += [
                                country_specific_code or
                                (partner_sum.get('sales_type_code') and partner_sum.get('sales_type_code')[i])
                                or None]
                            if has_found_a_line and options['sales_report_taxes'].get('use_taxes_instead_of_tags'):
                                break # We only want the first line to avoid amount multiplication in the generic report
                    partner_values[col_grp_key]['sales_type_code'] = ', '.join(partner_values[col_grp_key]['sales_type_code'])
                if has_found_a_line:
                    lines.append((0, self._sales_report_get_report_line_partner(options, partner, partner_values)))

        # Report total line.
        lines.append((0, self._sales_report_get_report_line_total(options, totals_by_column_group)))
        return lines

    def _sales_report_get_report_line_partner(self, options, partner, partner_values):
        """
        Convert the partner values to a report line.
        :param dict options: Report options
        :param recordset partner: the corresponding res.partner record
        :param dict partner_values: Dictionary of values for the report line
        :return dict: Return a dict with the values for the report line.
        """
        column_values = []
        for column in options['columns']:
            expression_label = column['expression_label']
            value = partner_values[column['column_group_key']].get(expression_label)
            column_values.append({
                'name': self.format_value(value, figure_type=column['figure_type']) if value is not None else value,
                'no_format': value,
                'class': 'number' if column['figure_type'] == 'monetary' else 'text'
            }) # value is not None => allows to avoid the "0.0" or None values but only those

        return {
            'id': self._get_generic_line_id('res.partner', partner.id),
            'name': partner is not None and (partner.name or '')[:128] or _('Unknown Partner'),
            'columns': column_values,
            'level': 2,
            'trust': partner.trust if partner else None,
            'caret_options': 'ec_sales',
        }

    def _sales_report_get_report_line_total(self, options, totals_by_column_group):
        """
        Convert the total values values to a report line.
        :param dict options: Report options
        :param dict totals_by_column_group: Dictionary of values for the total line
        :return dict: Return a dict with the values for the report line.
        """
        column_values = []
        for column in options['columns']:
            value = totals_by_column_group[column['column_group_key']].get(column['expression_label'])
            column_values.append({
                'name': self.format_value(value, figure_type=column['figure_type']) if value is not None else None,
                'no_format': value if column['figure_type'] == 'monetary' else '',
                'class': 'number' if column['figure_type'] == 'monetary' else 'text'
            })

        return {
            'id': self._get_generic_line_id(None, None, markup='total'),
            'name': _('Total'),
            'class': 'total',
            'level': 1,
            'columns': column_values,
        }

    def _sales_report_query_partners(self, options):
        ''' Execute the queries, perform all the computation, then
        returns a lists of tuple (partner, fetched_values) sorted by the table's model _order:
            - partner is a res.parter record.
            - fetched_values is a dictionary containing:
                - sums by operation type:           {'goods': float,
                                                     'triangular': float,
                                                     'services': float,

                - tax identifiers:                   'tax_element_id': list[int], > the tag_id in almost every case
                                                     'sales_type_code': list[str],

                - partner identifier elements:       'vat_number': str,
                                                     'full_vat_number': str,
                                                     'country_code': str}

        :param options:             The report options.
        :return:                    (accounts_values, taxes_results)
        '''
        groupby_partners = {}

        def assign_sum(row):
            """
            Assign corresponding values from the SQL querry row to the groupby_partners dictionary.
            If the line balance isn't 0, find the tax tag_id and check in which column/report line the SQL line balance
            should be displayed.

            The tricky part is to allow for the report to be displayed in vertical or horizontal format.
            In vertical, you have up to 3 lines per partner (one for each operation type).
            In horizontal, you have one line with 3 columns per partner (one for each operation type).

            Add then the more straightforward data (vat number, country code, ...)
            :param dict row:
            """
            if not company_currency.is_zero(row['balance']):
                groupby_partners.setdefault(row['groupby'], defaultdict(lambda: defaultdict(float)))

                groupby_partners_keyed = groupby_partners[row['groupby']][row['column_group_key']]
                if row['tax_element_id'] in options['sales_report_taxes']['goods']:
                    groupby_partners_keyed['goods'] += row['balance']
                elif row['tax_element_id'] in options['sales_report_taxes']['triangular']:
                    groupby_partners_keyed['triangular'] += row['balance']
                elif row['tax_element_id'] in options['sales_report_taxes']['services']:
                    groupby_partners_keyed['services'] += row['balance']

                groupby_partners_keyed.setdefault('tax_element_id', []).append(row['tax_element_id'])
                groupby_partners_keyed.setdefault('sales_type_code', []).append(row['sales_type_code'])

                vat = row['vat_number'] or ''
                groupby_partners_keyed.setdefault('vat_number', vat[2:])
                groupby_partners_keyed.setdefault('full_vat_number', vat)
                groupby_partners_keyed.setdefault('country_code', vat[:2])

        company_currency = self.env.company.currency_id

        # Execute the queries and dispatch the results.
        query, params = self._sales_report_get_query_sums(options)
        self._cr.execute(query, params)

        dictfetchall = self._cr.dictfetchall()
        for res in dictfetchall:
            assign_sum(res)

        if groupby_partners:
            partners = self.env['res.partner'].with_context(active_test=False).browse(groupby_partners.keys())
        else:
            partners = self.env['res.partner']

        return [(partner, groupby_partners[partner.id]) for partner in partners]

    def _sales_report_get_query_sums(self, options):
        ''' Construct a query retrieving all the aggregated sums to build the report. It includes:
        - sums for all partners.
        - sums for the initial balances.
        :param options:             The report options.
        :return:                    (query, params)
        '''
        params = []
        queries = []
        # Create the currency table.
        ct_query = self.env['res.currency']._get_query_currency_table(options)
        allowed_ids = self._sales_report_get_tag_ids_filtered(options)

        # In the case of the generic report, we don't have a country defined. So no reliable tax report whose
        # tag_ids can be used. So we have a fallback to tax_ids.

        if options.get('sales_report_taxes', {}).get('use_taxes_instead_of_tags'):
            tax_elem_table = 'account_tax'
            aml_rel_table = 'account_move_line_account_tax_rel'
        else:
            tax_elem_table = 'account_account_tag'
            aml_rel_table = 'account_account_tag_account_move_line_rel'

        for column_group_key, column_group_options in self._split_options_per_column_group(options).items():
            tables, where_clause, where_params = self._query_get(column_group_options, 'normal')
            params.append(column_group_key)
            params += where_params
            if allowed_ids:
                where_clause += f" AND {tax_elem_table}.id IN %s"  # Add the tax element filter.
                params.append(tuple(allowed_ids))
            queries.append(f"""
                SELECT
                    %s                              AS column_group_key,
                    account_move_line.partner_id    AS groupby,
                    res_partner.vat                 AS vat_number,
                    res_country.code                AS country_code,
                    -SUM(account_move_line.balance) AS balance,
                    {tax_elem_table}.name           AS sales_type_code,
                    {tax_elem_table}.id             AS tax_element_id
                FROM {tables}
                JOIN {ct_query} ON currency_table.company_id = account_move_line.company_id
                JOIN {aml_rel_table} ON {aml_rel_table}.account_move_line_id = account_move_line.id
                JOIN {tax_elem_table} ON {aml_rel_table}.{tax_elem_table}_id = {tax_elem_table}.id
                JOIN res_partner ON account_move_line.partner_id = res_partner.id
                JOIN res_country ON res_partner.country_id = res_country.id
                WHERE {where_clause}
                GROUP BY {tax_elem_table}.id, {tax_elem_table}.name, account_move_line.partner_id,
                res_partner.vat, res_country.code
            """)
        return ' UNION ALL '.join(queries), params

    @api.model
    def _sales_report_get_tag_ids_filtered(self, options):
        """
        Helper function to get all the tag_ids concerned by the report for the given options.
        :param dict options: Report options
        :return tuple: tag_ids untyped after filtering
        """
        allowed_taxes = set()
        for operation_type in options.get('ec_tax_filter_selection', []):
            if operation_type.get('selected'):
                allowed_taxes.update(options['sales_report_taxes'][operation_type.get('id')])
        return allowed_taxes

    def get_non_vat_actions_window(self, options, params):
        res = {
            'name': _("Entries with partners with no VAT"),
            'type': 'ir.actions.act_window',
            'context': {
                'search_default_group_by_partner': 1,
                'expand': 1
            },
        }
        amls = self._get_act_window_amls(options, [
            ('partner_id.vat', '=', None),
            # this warning only shows for EC country partners (if not EC country, an other warning is triggered)
            ('partner_id.country_id.code', 'in', tuple(self.get_ec_country_codes(options)))
        ],)
        if params.get('model') == 'move':
            res.update({
                'views': [[self.env.ref('account.view_move_tree').id, 'list'], (False, 'form')],
                'res_model': 'account.move',
                'domain': [('id', 'in', amls.move_id.ids)],
            })
        else:
            res.update({
                'views': [(False, 'list'), (False, 'form')],
                'res_model': 'res.partner',
                'domain': [('id', 'in', amls.move_id.partner_id.ids)],
            })
        return res

    def get_non_ec_countries_actions_window(self, options, params):
        res = {
            'name': _("EC tax on non EC countries"),
            'type': 'ir.actions.act_window',
            'context': {},
        }
        amls = self._get_act_window_amls(options, [
            ('partner_id.country_id.code', 'not in', tuple(self.sales_report_get_ec_country_codes(options)))
        ])
        if params.get('model') == 'move':
            res.update({
                'views': [[self.env.ref('account.view_move_tree').id, 'list'], (False, 'form')],
                'res_model': 'account.move',
                'domain': [('id', 'in', amls.move_id.ids)],
            })
        else:
            res.update({
                'views': [(False, 'list'), (False, 'form')],
                'res_model': 'res.partner',
                'domain': [('id', 'in', amls.move_id.partner_id.ids)],
            })
        return res

    def get_same_country_actions_window(self, options, params):
        res = {
            'name': _("EC tax on same country"),
            'type': 'ir.actions.act_window',
            'context': {},
        }
        amls = self._get_act_window_amls(options, [
            ('partner_id.country_id.code', '=', self.sales_report_get_ec_country_codes(options))
        ])
        if params.get('model') == 'move':
            res.update({
                'views': [[self.env.ref('account.view_move_tree').id, 'list'], (False, 'form')],
                'res_model': 'account.move',
                'domain': [('id', 'in', amls.move_id.ids)],
            })
        else:
            res.update({
                'views': [(False, 'list'), (False, 'form')],
                'res_model': 'res.partner',
                'domain': [('id', 'in', amls.move_id.partner_id.ids)],
            })
        return res

    def _get_act_window_amls(self, options, domain):
        if not domain:
            domain = []

        selected_tax_report_line_ids = []
        all_tax_report_line_ids = []
        for ec_sale_code_opt in options['ec_sale_code']:
            if ec_sale_code_opt['selected']:
                selected_tax_report_line_ids += ec_sale_code_opt['tax_report_line_ids']
            all_tax_report_line_ids += ec_sale_code_opt['tax_report_line_ids']

        tax_report_line_ids = selected_tax_report_line_ids or all_tax_report_line_ids # Nothing selected means everything needs to be considered
        if tax_report_line_ids:
            domain.append(('tax_tag_ids.tax_report_line_ids', 'in', tax_report_line_ids))

        domain += [
            ('date', '>=', options['date']['date_from']),
            ('date', '<=', options['date']['date_to']),
        ]
        return self.env['account.move.line'].search(domain)

    @api.model
    def sales_report_get_ec_country_codes(self, options):
        """
        Return the list of country codes for the EC countries.
        :param dict options: Report options
        :return set: List of country codes for a given date (UK case)
        """
        rslt = {'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
                'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'}

        # GB left the EU on January 1st 2021. But before this date, it's still to be considered as a EC country
        if fields.Date.from_string(options['date']['date_from']) < fields.Date.from_string('2021-01-01'):
            rslt.add('GB')
        return rslt
