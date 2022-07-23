# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.tools import format_date
from itertools import groupby
from collections import defaultdict

MAX_NAME_LENGTH = 50


class AssetsReport(models.Model):
    _inherit = 'account.report'

    def _custom_options_initializer_assets_report(self, options, previous_options=None):
        column_group_options_map = self._split_options_per_column_group(options)

        for col in options['columns']:
            column_group_options = column_group_options_map[col['column_group_key']]
            # Dynamic naming of columns containing dates
            if col['expression_label'] == 'balance':
                col['name'] = '' # The column label will be displayed in the subheader
            if col['expression_label'] in ['assets_date_from', 'depre_date_from']:
                col['name'] = format_date(self.env, column_group_options['date']['date_from'])
            elif col['expression_label'] in ['assets_date_to', 'depre_date_to']:
                col['name'] = format_date(self.env, column_group_options['date']['date_to'])

        options['custom_columns_subheaders'] = [
            {"name": "Characteristics", "colspan": 4},
            {"name": "Assets", "colspan": 4},
            {"name": "Depreciation", "colspan": 4},
            {"name": "Book Value", "colspan": 1}
        ]

        # Unfold all by default
        options['unfold_all'] = (previous_options or {}).get('unfold_all', True)

        # Group by account by default
        groupby_activated = (previous_options or {}).get('assets_groupby_account', True)
        options['assets_groupby_account'] = groupby_activated
        # If group by account is activated, activate the hierarchy (which will group by account group as well) if
        # the company has at least one account group, otherwise only group by account
        has_account_group = self.env['account.group'].search_count([('company_id', '=', self.env.company.id)], limit=1)
        options['hierarchy'] = has_account_group and groupby_activated or False

    def _get_caret_option_view_map(self):
        view_map = super()._get_caret_option_view_map()
        view_map['account.asset.line'] = 'account_asset.view_account_asset_expense_form'
        return view_map

    def _caret_options_initializer_assets_report(self):
        # Use 'caret_option_open_record_form' defined in account_reports rather than a custom function
        return {
            'account_asset_line': [
                {'name': _("Open Asset"), 'action': 'caret_option_open_record_form'},
            ]
        }

    def _assets_with_context_company2code2account(self):
        if self.env.context.get('company2code2account') is not None:
            return self

        company2code2account = defaultdict(dict)
        for account in self.env['account.account'].search([]):
            company2code2account[account.company_id.id][account.code] = account

        return self.with_context(company2code2account=company2code2account)

    def _asset_get_rate_cached(self, from_currency, to_currency, company, date, cache):
        if from_currency == to_currency:
            return 1
        key = (from_currency, to_currency, company, date)
        if key not in cache:
            cache[key] = self.env['res.currency']._get_conversion_rate(*key)
        return cache[key]

    def _dynamic_lines_generator_assets_report(self, options, all_column_groups_expression_totals):
        self = self._assets_with_context_company2code2account()

        # construct a dictionary:
        #   {(account_id, asset_id): {col_group_key: {expression_label_1: value, expression_label_2: value, ...}}}
        all_asset_ids = set()
        all_lines_data = {}
        for column_group_key, column_group_options in self._split_options_per_column_group(options).items():
            # the lines returned are already sorted by account_id !
            lines_query_results = self._assets_query_lines(column_group_options)
            for account_id, asset_id, cols_by_expr_label in lines_query_results:
                line_id = (account_id, asset_id)
                all_asset_ids.add(asset_id)
                if line_id not in all_lines_data:
                    all_lines_data[line_id] = {column_group_key: []}
                all_lines_data[line_id][column_group_key] = cols_by_expr_label

        column_names = [
            'assets_date_from', 'assets_plus', 'assets_minus', 'assets_date_to', 'depre_date_from',
            'depre_plus', 'depre_minus', 'depre_date_to', 'balance'
        ]
        totals_by_column_group = defaultdict(lambda: dict.fromkeys(column_names, 0.0))

        # Browse all the necessary assets in one go, to minimize the number of queries
        assets_cache = {asset.id: asset for asset in self.env['account.asset'].browse(all_asset_ids)}

        # construct the lines, 1 at a time
        lines = []
        company_currency = self.env.company.currency_id
        for (account_id, asset_id), col_group_totals in all_lines_data.items():
            all_columns = []
            for column_data in options['columns']:
                col_group_key = column_data['column_group_key']
                expr_label = column_data['expression_label']
                if col_group_key not in col_group_totals or expr_label not in col_group_totals[col_group_key]:
                    all_columns.append({})
                    continue

                col_value = col_group_totals[col_group_key][expr_label]
                if col_value is None:
                    all_columns.append({})
                elif column_data['figure_type'] == 'monetary':
                    all_columns.append({
                        'name': self.format_value(col_value, company_currency, figure_type='monetary'),
                        'no_format': col_value,
                    })
                else:
                    all_columns.append({'name': col_value, 'no_format': col_value})

                # add to the total line
                if column_data['figure_type'] == 'monetary':
                    totals_by_column_group[column_data['column_group_key']][column_data['expression_label']] += col_value

            name = assets_cache[asset_id].name
            line = {
                'id': self._get_generic_line_id('account.asset', asset_id),
                'level': 1,
                'name': name,
                'columns': all_columns,
                'unfoldable': False,
                'unfolded': False,
                'caret_options': 'account_asset_line',
                'class': 'o_account_asset_column_contrast',
                'assets_account_id': account_id,
            }
            if len(name) >= MAX_NAME_LENGTH:
                line['title_hover'] = name
            lines.append(line)

        # add the groups by account
        if options['assets_groupby_account']:
            lines = self._assets_group_by_account(lines, options)

        # add the total line
        total_columns = []
        for column_data in options['columns']:
            col_value = totals_by_column_group[column_data['column_group_key']].get(column_data['expression_label'])
            if column_data.get('figure_type') == 'monetary':
                total_columns.append({'name': self.format_value(col_value, company_currency, figure_type='monetary')})
            else:
                total_columns.append({})

        lines.append({
            'id': self._get_generic_line_id(None, None, markup='total'),
            'level': 1,
            'class': 'total',
            'name': _('Total'),
            'columns': total_columns,
            'unfoldable': False,
            'unfolded': False,
        })
        return [(0, line) for line in lines]

    def _assets_query_lines(self, options):
        """
        Returns a list of tuples: [(asset_id, account_id, [{expression_label: value}])]
        """
        lines = []
        asset_lines = self._assets_query_values(options)
        curr_cache = {}

        for company_id, company_asset_lines in groupby(asset_lines, key=lambda x: x['company_id']):
            parent_lines = []
            children_lines = defaultdict(list)
            company = self.env['res.company'].browse(company_id)
            company_currency = company.currency_id
            for al in company_asset_lines:
                if al['parent_id']:
                    children_lines[al['parent_id']] += [al]
                else:
                    parent_lines += [al]
            for al in parent_lines:
                if al['asset_method'] == 'linear' and al['asset_method_number']:  # some assets might have 0 depreciations because they dont lose value
                    total_months = int(al['asset_method_number']) * int(al['asset_method_period'])
                    months = total_months % 12
                    years = total_months // 12
                    asset_depreciation_rate = " ".join(part for part in [
                        years and _("%s y", years),
                        months and _("%s m", months),
                    ] if part)
                elif al['asset_method'] == 'linear':
                    asset_depreciation_rate = '0.00 %'
                else:
                    asset_depreciation_rate = ('{:.2f} %').format(float(al['asset_method_progress_factor']) * 100)

                al_currency = self.env['res.currency'].browse(al['asset_currency_id'])
                al_rate = self._asset_get_rate_cached(al_currency, company_currency, company, al['asset_acquisition_date'], curr_cache)

                depreciation_opening = company_currency.round(al['depreciated_start'] * al_rate) - company_currency.round(al['depreciation'] * al_rate)
                depreciation_closing = company_currency.round(al['depreciated_end'] * al_rate)
                depreciation_minus = 0.0

                opening = (al['asset_acquisition_date'] or al['asset_date']) < fields.Date.to_date(options['date']['date_from'])
                asset_opening = company_currency.round(al['asset_original_value'] * al_rate) if opening else 0.0
                asset_add = 0.0 if opening else company_currency.round(al['asset_original_value'] * al_rate)
                asset_minus = 0.0

                if al['import_depreciated']:
                    asset_opening += asset_add
                    asset_add = 0
                    depreciation_opening += al['import_depreciated']
                    depreciation_closing += al['import_depreciated']

                for child in children_lines[al['asset_id']]:
                    child_currency = self.env['res.currency'].browse(child['asset_currency_id'])
                    child_rate = self._asset_get_rate_cached(child_currency, company_currency, company, child['asset_acquisition_date'], curr_cache)

                    depreciation_opening += company_currency.round(child['depreciated_start'] * child_rate) - company_currency.round(child['depreciation'] * child_rate)
                    depreciation_closing += company_currency.round(child['depreciated_end'] * child_rate)

                    opening = (child['asset_acquisition_date'] or child['asset_date']) < fields.Date.to_date(options['date']['date_from'])
                    asset_opening += company_currency.round(child['asset_original_value'] * child_rate) if opening else 0.0
                    asset_add += 0.0 if opening else company_currency.round(child['asset_original_value'] * child_rate)

                depreciation_add = depreciation_closing - depreciation_opening
                asset_closing = asset_opening + asset_add

                if al['asset_state'] == 'close' and al['asset_disposal_date'] and al['asset_disposal_date'] <= fields.Date.to_date(options['date']['date_to']):
                    depreciation_minus = depreciation_closing
                    # depreciation_opening and depreciation_add are computed from first_move (assuming it is a depreciation move),
                    # but when previous condition is True and first_move and last_move are the same record, then first_move is not a
                    # depreciation move.
                    # In that case, depreciation_opening and depreciation_add must be corrected.
                    if al['first_move_id'] == al['last_move_id']:
                        depreciation_opening = depreciation_closing
                        depreciation_add = 0
                    depreciation_closing = 0.0
                    asset_minus = asset_closing
                    asset_closing = 0.0

                asset_gross = asset_closing - depreciation_closing

                current_values = [asset_opening, asset_add, asset_minus, asset_closing, depreciation_opening,
                                  depreciation_add, depreciation_minus, depreciation_closing, asset_gross]

                columns_by_expr_label = {
                    options['columns'][0]['expression_label']: al['asset_acquisition_date'] and format_date(self.env, al['asset_acquisition_date']) or '',  # Characteristics
                    options['columns'][1]['expression_label']: al['asset_date'] and format_date(self.env, al['asset_date']) or '',
                    options['columns'][2]['expression_label']: (al['asset_method'] == 'linear' and _('Linear')) or (al['asset_method'] == 'degressive' and _('Declining')) or _('Dec. then Straight'),
                    options['columns'][3]['expression_label']: asset_depreciation_rate}
                for val, idx in zip(current_values, range(4, 13)):
                    columns_by_expr_label.update({options['columns'][idx]['expression_label']: val})
                lines.append((al['account_id'], al['asset_id'], columns_by_expr_label))
        return lines

    def _assets_group_by_account(self, lines, options):
        """
        This function adds the grouping lines on top of each group of account.asset
        It iterates over the lines, change the line_id of each line to include the account.account.id and the
        account.asset.id.
        """
        if not lines:
            return lines

        rslt_lines = []
        idx_monetary_columns = [idx_col for idx_col, col in enumerate(options['columns']) if col['figure_type'] == 'monetary']
        # while iterating, we compare the 'parent_account_id' with the 'current_account_id' of each line,
        # and sum the monetary amounts into 'group_total', the lines belonging to the same account.account.id are
        # added to 'group_lines'
        parent_account_id = lines[0].get('assets_account_id')  # get parent id name
        group_total = [0] * len(idx_monetary_columns)
        group_lines = []

        dummy_extra_line = {'id': '-account.account-1', 'columns': [{'name': 0, 'no_format': 0}] * len(options['columns'])}
        for line in lines + [dummy_extra_line]:
            line_amounts = [line['columns'][idx].get('no_format', 0) for idx in idx_monetary_columns]
            current_parent_account_id = line.get('assets_account_id')
            # replace the line['id'] to add the account.account.id
            line['id'] = self._build_line_id([
                (None, 'account.account', current_parent_account_id),
                (None, 'account.asset', self._get_model_info_from_id(line['id'])[-1])
            ])
            # if True, the current lines belongs to another account.account.id, we know the preceding group is complete
            # so we can add the grouping line of the preceding group (corresponding to the parent_account_id).
            if current_parent_account_id != parent_account_id:
                account = self.env['account.account'].browse(parent_account_id)
                columns = []
                for idx_col in range(len(options['columns'])):
                    if idx_col in idx_monetary_columns:
                        tot_val = group_total.pop(0)
                        columns.append({
                            'name': self.format_value(tot_val, self.env.company.currency_id, figure_type='monetary'),
                            'no_format': tot_val
                        })
                    else:
                        columns.append({})
                new_line = {
                    'id': self._build_line_id([(None, 'account.account', parent_account_id)]),
                    'name': f"{account.code} {account.name}",
                    'unfoldable': True,
                    'unfolded': options.get('unfold_all', False),
                    'level': 1,
                    'columns': columns,
                    'class': 'o_account_asset_column_contrast',
                }
                rslt_lines += [new_line] + group_lines
                # Reset the control variables
                parent_account_id = current_parent_account_id
                group_total = [0] * len(idx_monetary_columns)
                group_lines = []
            # Add the line amount to the current group_total, set the line's parent_id and add the line to the
            # current group of lines
            group_total = [x + y for x, y in zip(group_total, line_amounts)]
            line['parent_id'] = self._build_line_id([(None, 'account.account', parent_account_id)])
            group_lines.append(line)
        return rslt_lines

    def _assets_query_values(self, options):
        "Get the data from the database"

        self.env['account.move.line'].check_access_rights('read')
        self.env['account.asset'].check_access_rights('read')

        where_account_move = " AND state != 'cancel'"
        if not options.get('all_entries'):
            where_account_move = " AND state = 'posted'"

        sql = """
                -- remove all the moves that have been reversed from the search
                CREATE TEMPORARY TABLE IF NOT EXISTS temp_account_move () INHERITS (account_move) ON COMMIT DROP;
                INSERT INTO temp_account_move SELECT move.*
                FROM ONLY account_move move
                LEFT JOIN ONLY account_move reversal ON reversal.reversed_entry_id = move.id
                WHERE reversal.id IS NULL AND move.asset_id IS NOT NULL AND move.company_id in %(company_ids)s;

                SELECT asset.id as asset_id,
                       asset.parent_id as parent_id,
                       asset.name as asset_name,
                       asset.original_value as asset_original_value,
                       asset.currency_id as asset_currency_id,
                       COALESCE(asset.first_depreciation_date_import, asset.first_depreciation_date) as asset_date,
                       asset.already_depreciated_amount_import as import_depreciated,
                       asset.disposal_date as asset_disposal_date,
                       asset.acquisition_date as asset_acquisition_date,
                       asset.method as asset_method,
                       (
                           COALESCE(account_move_count.count, 0)
                           + COALESCE(asset.depreciation_number_import, 0)
                           - CASE WHEN asset.prorata THEN 1 ELSE 0 END
                       ) as asset_method_number,
                       asset.method_period as asset_method_period,
                       asset.method_progress_factor as asset_method_progress_factor,
                       asset.state as asset_state,
                       account.code as account_code,
                       account.name as account_name,
                       account.id as account_id,
                       account.company_id as company_id,
                       COALESCE(first_move.asset_depreciated_value, move_before.asset_depreciated_value, 0.0) as depreciated_start,
                       COALESCE(first_move.asset_remaining_value, move_before.asset_remaining_value, 0.0) as remaining_start,
                       COALESCE(last_move.asset_depreciated_value, move_before.asset_depreciated_value, 0.0) as depreciated_end,
                       COALESCE(last_move.asset_remaining_value, move_before.asset_remaining_value, 0.0) as remaining_end,
                       COALESCE(first_move.amount_total, 0.0) as depreciation,
                       COALESCE(first_move.id, move_before.id) as first_move_id,
                       COALESCE(last_move.id, move_before.id) as last_move_id
                FROM account_asset as asset
                LEFT JOIN account_account as account ON asset.account_asset_id = account.id
                LEFT JOIN (
                    SELECT
                        COUNT(*) as count,
                        asset_id
                    FROM temp_account_move
                    WHERE asset_value_change != 't'
                    GROUP BY asset_id
                ) account_move_count ON asset.id = account_move_count.asset_id

                LEFT OUTER JOIN (
                    SELECT DISTINCT ON (asset_id)
                        id,
                        asset_depreciated_value,
                        asset_remaining_value,
                        amount_total,
                        asset_id
                    FROM temp_account_move m
                    WHERE date >= %(date_from)s AND date <= %(date_to)s {where_account_move}
                    ORDER BY asset_id, date, id DESC
                ) first_move ON first_move.asset_id = asset.id

                LEFT OUTER JOIN (
                    SELECT DISTINCT ON (asset_id)
                        id,
                        asset_depreciated_value,
                        asset_remaining_value,
                        amount_total,
                        asset_id
                    FROM temp_account_move m
                    WHERE date >= %(date_from)s AND date <= %(date_to)s {where_account_move}
                    ORDER BY asset_id, date DESC, id DESC
                ) last_move ON last_move.asset_id = asset.id

                LEFT OUTER JOIN (
                    SELECT DISTINCT ON (asset_id)
                        id,
                        asset_depreciated_value,
                        asset_remaining_value,
                        amount_total,
                        asset_id
                    FROM temp_account_move m
                    WHERE date <= %(date_from)s {where_account_move}
                    ORDER BY asset_id, date DESC, id DESC
                ) move_before ON move_before.asset_id = asset.id

                WHERE asset.company_id in %(company_ids)s
                AND asset.acquisition_date <= %(date_to)s
                AND (asset.disposal_date >= %(date_from)s OR asset.disposal_date IS NULL)
                AND asset.state not in ('model', 'draft', 'cancelled')
                AND asset.asset_type = 'purchase'
                AND asset.active = 't'

                ORDER BY account.code, asset.acquisition_date;
            """.format(where_account_move=where_account_move)

        if options.get('multi_company', False):
            company_ids = tuple(self.env.companies.ids)
        else:
            company_ids = tuple(self.env.company.ids)

        self._cr.execute(sql, {
            'date_to': options['date']['date_to'],
            'date_from': options['date']['date_from'],
            'company_ids': company_ids,
        })
        results = self._cr.dictfetchall()
        self._cr.execute("DROP TABLE temp_account_move")  # Because tests are run in the same transaction, we need to clean here the SQL INHERITS
        return results
