# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _
from .supplementary_unit_codes import SUPPLEMENTARY_UNITS_TO_COMMODITY_CODES as SUPP_TO_COMMODITY

_merchandise_export_code = {
    'BE': '29',
    'FR': '21',
    'NL': '7',
}

_merchandise_import_code = {
    'BE': '19',
    'FR': '11',
    'NL': '6',
}

_unknown_country_code = {
    'BE': 'QU',
    'NL': 'QV',
}

_qn_unknown_individual_vat_country_codes = ('FI', 'SE', 'SK', 'DE', 'AT')

class IntrastatReport(models.Model):
    _inherit = 'account.report'

    ####################################################
    # OVERRIDES
    ####################################################

    def _intrastat_show_region_code(self):
        """Return a bool indicating if the region code is to be displayed for the country concerned in this localisation."""
        # TO OVERRIDE
        return True

    ####################################################
    # OPTIONS: INIT
    ####################################################

    def _custom_options_initializer_intrastat(self, options, previous_options=None):
        previous_options = previous_options or {}

        # Filter only partners with VAT
        options['intrastat_with_vat'] = previous_options.get('intrastat_with_vat', False)

        # Filter types of invoices
        default_type = [
            {'name': _('Arrival'), 'selected': False, 'id': 'arrival'},
            {'name': _('Dispatch'), 'selected': False, 'id': 'dispatch'},
        ]
        options['intrastat_type'] = previous_options.get('intrastat_type', default_type)
        options['country_format'] = previous_options.get('country_format')
        options['commodity_flow'] = previous_options.get('commodity_flow')

        # Filter the domain based on the types of invoice selected
        include_arrivals = options['intrastat_type'][0]['selected']
        include_dispatches = options['intrastat_type'][1]['selected']
        if not include_arrivals and not include_dispatches:
            include_arrivals = include_dispatches = True

        invoice_types = []
        if include_arrivals:
            invoice_types += ['in_invoice', 'out_refund']
        if include_dispatches:
            invoice_types += ['out_invoice', 'in_refund']

        # When only one type is selected, we can display a total line
        options['intrastat_total_line'] = include_arrivals != include_dispatches
        options.setdefault('forced_domain', []).append(('move_id.move_type', 'in', invoice_types))

        # Filter report type (extended form)
        options['intrastat_extended'] = previous_options.get('intrastat_extended', True)

        # 2 columns are conditional and should only appear when rendering the extended intrastat report
        # Some countries don't use the region code column; we hide it for them.
        excluded_columns = set()
        if not options['intrastat_extended']:
            excluded_columns |= {'transport_code', 'incoterm_code'}
        if not self._intrastat_show_region_code():
            excluded_columns.add('region_code')

        new_columns = []
        for col in options['columns']:
            if col['expression_label'] not in excluded_columns:
                new_columns.append(col)

                # Replace country names by codes if necessary (for file exports)
                if options.get('country_format') == 'code':
                    if col['expression_label'] == 'country_name':
                        col['expression_label'] = 'country_code'
                    elif col['expression_label'] == 'intrastat_product_origin_country_name':
                        col['expression_label'] = 'intrastat_product_origin_country_code'

        # Only pick Sale/Purchase journals (+ divider)
        self._init_options_journals(options, previous_options=previous_options, additional_journals_domain=[('type', 'in', ('sale', 'purchase'))])

        # When printing the report to xlsx, we want to use country codes instead of names
        xlsx_button_option = next(button_opt for button_opt in options['buttons'] if button_opt.get('action_param') == 'export_to_xlsx')
        xlsx_button_option['action_param'] = 'intrastat_export_to_xlsx'

    def intrastat_export_to_xlsx(self, options, response=None):
        # We need to regenerate the options to make sure we hide the country name columns as expected.
        new_options = self._get_options(previous_options={**options, 'country_format': 'code', 'commodity_flow': 'code'})
        return self.export_to_xlsx(new_options, response=response)

    ####################################################
    # REPORT LINES: CORE
    ####################################################

    @api.model
    def _dynamic_lines_generator_intrastat(self, options, all_column_groups_expression_totals):
        # dict of the form {move_id: {column_group_key: {expression_label: value}}}
        move_info_dict = {}

        # dict of the form {column_group_key: total_value}
        total_values_dict = {}

        # Build query
        query_list = []
        full_query_params = []
        for column_group_key, column_group_options in self._split_options_per_column_group(options).items():
            query, params = self._intrastat_prepare_query(column_group_options, column_group_key)
            query_list.append(f"({query})")
            full_query_params += params

        full_query = " UNION ALL ".join(query_list)
        self._cr.execute(full_query, full_query_params)
        results = self._cr.dictfetchall()
        results = self._intrastat_fill_supplementary_units(results)

        # Fill dictionaries
        for result in self._intrastat_fill_missing_values(results):
            move_id = result['id']
            column_group_key = result['column_group_key']

            current_move_info = move_info_dict.setdefault(move_id, {})

            current_move_info[column_group_key] = result
            current_move_info['name'] = result['name']

            total_values_dict.setdefault(column_group_key, 0)
            total_values_dict[column_group_key] += result['value']

        # Create lines
        lines = []
        for move_id, move_info in move_info_dict.items():
            line = self._intrastat_create_report_line(options, move_info, move_id, ['value'])
            lines.append((0, line))

        # Create total line if only one type of invoice is selected
        if options.get('intrastat_total_line'):
            total_line = self._intrastat_create_report_total_line(options, total_values_dict)
            lines.append((0, total_line))
        return lines

    @api.model
    def _intrastat_create_report_line(self, options, line_vals, line_id, number_values):
        """ Create a standard (non-total) line for the report

        :param options: report options
        :param line_vals: values necessary for the line
        :param line_id: id of the line
        :param number_values: list of expression labels that need to have the 'number' class
        """
        columns = []
        for column in options['columns']:
            expression_label = column['expression_label']
            value = line_vals.get(column['column_group_key'], {}).get(expression_label, False)

            if options.get('commodity_flow') != 'code' and column['expression_label'] == 'system':
                value = f"{value} ({line_vals.get(column['column_group_key'], {}).get('type', False)})"

            columns.append({
                'name': self.format_value(value, figure_type=column['figure_type']) if value else None,
                'no_format': value,
                'class': 'number' if expression_label in number_values else '',
            })

        return {
            'id': self._get_generic_line_id('account.move.line', line_id),
            'caret_options': 'account.move',
            'name': line_vals['name'],
            'columns': columns,
            'level': 2,
        }

    @api.model
    def _intrastat_create_report_total_line(self, options, total_vals):
        """ Create a total line for the report

        :param options: report options
        :param total_vals: total values dict
        """
        columns = []
        for column in options['columns']:
            expression_label = column['expression_label']
            value = total_vals.get(column['column_group_key'], {}).get(expression_label, False)

            columns.append({
                'name': self.format_value(value, figure_type=column['figure_type']) if value else None,
                'no_format': value,
                'class': 'number',
            })
        return {
            'id': self._get_generic_line_id(None, None, markup='total'),
            'name': _('Total'),
            'class': 'total',
            'level': 1,
            'columns': columns,
        }

    ####################################################
    # REPORT LINES: QUERY
    ####################################################

    @api.model
    def _intrastat_prepare_query(self, options, column_group_key=None):
        query_blocks, where_params = self._intrastat_build_query(options, column_group_key)
        query = f"{query_blocks['select']} {query_blocks['from']} {query_blocks['where']} {query_blocks['order']}"
        return query, where_params

    @api.model
    def _intrastat_build_query(self, options, column_group_key=None):
        # triangular use cases are handled by letting the intrastat_country_id editable on
        # invoices. Modifying or emptying it allow to alter the intrastat declaration
        # accordingly to specs (https://www.nbb.be/doc/dq/f_pdf_ex/intra2017fr.pdf (§ 4.x))
        tables, where_clause, where_params = self._query_get(options, 'strict_range')

        import_merchandise_code = _merchandise_import_code.get(self.env.company.country_id.code, '29')
        export_merchandise_code = _merchandise_export_code.get(self.env.company.country_id.code, '19')
        unknown_individual_vat = 'QN999999999999' if self.env.company.country_id.code in _qn_unknown_individual_vat_country_codes else 'QV999999999999'
        unknown_country_code = _unknown_country_code.get(self.env.company.country_id.code, 'QV')
        weight_category_id = self.env['ir.model.data']._xmlid_to_res_id('uom.product_uom_categ_kgm')

        select = """
            SELECT
                %s AS column_group_key,
                row_number() over () AS sequence,
                CASE WHEN account_move.move_type IN ('in_invoice', 'out_refund') THEN %s ELSE %s END AS system,
                country.code AS country_code,
                country.name AS country_name,
                company_country.code AS comp_country_code,
                transaction.code AS transaction_code,
                company_region.code AS region_code,
                code.code AS commodity_code,
                account_move_line.id AS id,
                prodt.id AS template_id,
                prodt.categ_id AS category_id,
                account_move_line.product_uom_id AS uom_id,
                inv_line_uom.category_id AS uom_category_id,
                account_move.id AS invoice_id,
                account_move.currency_id AS invoice_currency_id,
                account_move.name,
                COALESCE(account_move.date, account_move.invoice_date) AS invoice_date,
                account_move.move_type AS invoice_type,
                COALESCE(inv_incoterm.code, comp_incoterm.code) AS incoterm_code,
                COALESCE(inv_transport.code, comp_transport.code) AS transport_code,
                CASE WHEN account_move.move_type IN ('in_invoice', 'out_refund') THEN 'Arrival' ELSE 'Dispatch' END AS type,
                partner.vat as partner_vat,
                ROUND(
                    prod.weight * account_move_line.quantity / (
                        CASE WHEN inv_line_uom.category_id IS NULL OR inv_line_uom.category_id = prod_uom.category_id
                        THEN inv_line_uom.factor ELSE 1 END
                    ) * (
                        CASE WHEN prod_uom.uom_type <> 'reference'
                        THEN prod_uom.factor ELSE 1 END
                    ),
                    SCALE(ref_weight_uom.rounding)
                ) AS weight,
                account_move_line.quantity / (
                    CASE WHEN inv_line_uom.category_id IS NULL OR inv_line_uom.category_id = prod_uom.category_id
                    THEN inv_line_uom.factor ELSE 1 END
                ) AS quantity,
                account_move_line.quantity AS line_quantity,
                CASE WHEN account_move_line.price_subtotal = 0 THEN account_move_line.price_unit * account_move_line.quantity ELSE account_move_line.price_subtotal END AS value,
                COALESCE(product_country.code, %s) AS intrastat_product_origin_country_code,
                product_country.name AS intrastat_product_origin_country_name,
                CASE WHEN partner.vat IS NOT NULL THEN partner.vat
                     WHEN partner.vat IS NULL AND partner.is_company IS FALSE THEN %s
                     ELSE 'QV999999999999'
                END AS partner_vat
        """
        from_ = f"""
            FROM
                {tables}
                JOIN account_move ON account_move.id = account_move_line.move_id
                LEFT JOIN account_intrastat_code transaction ON account_move_line.intrastat_transaction_id = transaction.id
                LEFT JOIN res_company company ON account_move.company_id = company.id
                LEFT JOIN account_intrastat_code company_region ON company.intrastat_region_id = company_region.id
                LEFT JOIN res_partner partner ON account_move_line.partner_id = partner.id
                LEFT JOIN res_partner comp_partner ON company.partner_id = comp_partner.id
                LEFT JOIN res_country country ON account_move.intrastat_country_id = country.id
                LEFT JOIN res_country company_country ON comp_partner.country_id = company_country.id
                INNER JOIN product_product prod ON account_move_line.product_id = prod.id
                LEFT JOIN product_template prodt ON prod.product_tmpl_id = prodt.id
                LEFT JOIN account_intrastat_code code ON code.id = COALESCE(prod.intrastat_variant_id, prodt.intrastat_id)
                LEFT JOIN uom_uom inv_line_uom ON account_move_line.product_uom_id = inv_line_uom.id
                LEFT JOIN uom_uom prod_uom ON prodt.uom_id = prod_uom.id
                LEFT JOIN account_incoterms inv_incoterm ON account_move.invoice_incoterm_id = inv_incoterm.id
                LEFT JOIN account_incoterms comp_incoterm ON company.incoterm_id = comp_incoterm.id
                LEFT JOIN account_intrastat_code inv_transport ON account_move.intrastat_transport_mode_id = inv_transport.id
                LEFT JOIN account_intrastat_code comp_transport ON company.intrastat_transport_mode_id = comp_transport.id
                LEFT JOIN res_country product_country ON product_country.id = account_move_line.intrastat_product_origin_country_id
                LEFT JOIN res_country partner_country ON partner.country_id = partner_country.id AND partner_country.intrastat IS TRUE
                LEFT JOIN uom_uom ref_weight_uom on ref_weight_uom.category_id = %s and ref_weight_uom.uom_type = 'reference'
        """
        where = f"""
            WHERE
                {where_clause}
                AND (account_move_line.price_subtotal != 0 OR account_move_line.price_unit * account_move_line.quantity != 0)
                AND company_country.id != country.id
                AND country.intrastat = TRUE AND (country.code != 'GB' OR account_move.date < '2021-01-01')
                AND prodt.type != 'service'
        """
        order = "ORDER BY account_move.invoice_date DESC, account_move_line.id"

        if options['intrastat_with_vat']:
            where += " AND partner.vat IS NOT NULL "

        query = {
            'select': select,
            'from': from_,
            'where': where,
            'order': order,
        }

        query_params = [
            column_group_key,
            import_merchandise_code,
            export_merchandise_code,
            unknown_country_code,
            unknown_individual_vat,
            weight_category_id,
            *where_params
        ]

        return query, query_params

    ####################################################
    # REPORT LINES: HELPERS
    ####################################################

    @api.model
    def _intrastat_fill_missing_values(self, vals_list):
        """ Some values are too complex to be retrieved in the SQL query.
        Then, this method is used to compute the missing values fetched from the database.

        :param vals_list:    A dictionary created by the dictfetchall method.
        """
        # Prefetch data before looping
        category_ids = self.env['product.category'].browse({vals['category_id'] for vals in vals_list})
        self.env['product.category'].search([('id', 'parent_of', category_ids.ids)]).read(['intrastat_id', 'parent_id'])

        for vals in vals_list:
            # Check account.intrastat.code
            # If missing, retrieve the commodity code by looking in the product category recursively.
            if not vals['commodity_code']:
                category_id = self.env['product.category'].browse(vals['category_id'])
                vals['commodity_code'] = category_id.search_intrastat_code().code

            # set transaction_code default value if none (this is overridden in account_intrastat_expiry)
            if not vals['transaction_code']:
                vals['transaction_code'] = 1

            # Check the currency.
            currency_id = self.env['res.currency'].browse(vals['invoice_currency_id'])
            company_currency_id = self.env.company.currency_id
            if currency_id != company_currency_id:
                vals['value'] = currency_id._convert(vals['value'], company_currency_id, self.env.company, vals['invoice_date'])
        return vals_list

    def _intrastat_fill_supplementary_units(self, query_results):
        """ Although the default measurement provided is the weight in kg, some commodities require a supplementary unit
        in the report.

            e.g. Livestock are measured p/st, which is to say per animal.
                 Bags of plastic artificial teeth (code 90212110) are measured 100 p/st, which is
                 per hundred teeth.
                 Code 29372200 Halogenated derivatives of corticosteroidal hormones are measured in grams... obviously.

        Since there is not always 1-to-1 mapping between these supplementary units, this function tries to occupy the field
        with the most accurate / relevant value, based on the available odoo units of measure. When the customer does not have
        inventory installed, or has left the UoM otherwise undefined, the default 'unit' UoM is used. In this case the quantity
        is used as the supplementary unit.
        """

        supp_unit_dict = {
            'p/st': {'uom_id': self.env.ref('uom.product_uom_unit'), 'factor': 1},
            'pa': {'uom_id': self.env.ref('uom.product_uom_unit'), 'factor': 2},
            '100 p/st': {'uom_id': self.env.ref('uom.product_uom_unit'), 'factor': 100},
            '1000 p/st': {'uom_id': self.env.ref('uom.product_uom_unit'), 'factor': 1000},
            'g': {'uom_id': self.env.ref('uom.product_uom_gram'), 'factor': 1},
            'm': {'uom_id': self.env.ref('uom.product_uom_meter'), 'factor': 1},
            'l': {'uom_id': self.env.ref('uom.product_uom_litre'), 'factor': 1},
        }

        # Transform the dictionary to the form Commodity code -> Supplementary unit name
        commodity_to_supp_code = {}
        for key in SUPP_TO_COMMODITY:
            commodity_to_supp_code.update({v: key for v in SUPP_TO_COMMODITY[key]})

        for vals in query_results:
            commodity_code = vals['commodity_code']
            supp_code = commodity_to_supp_code.get(commodity_code)
            supp_unit = supp_unit_dict.get(supp_code)
            if not supp_code or not supp_unit:
                vals['supplementary_units'] = None
                continue

            # If the supplementary unit is undefined here, the best we can do is
            uom_id, uom_category_id = vals['uom_id'], vals['uom_category_id']

            if uom_id == supp_unit['uom_id'].id:
                vals['supplementary_units'] = vals['line_quantity'] / supp_unit['factor']
            else:
                if uom_category_id == supp_unit['uom_id'].category_id.id:
                    vals['supplementary_units'] = self.env['uom.uom'].browse(uom_id)._compute_quantity(vals['line_quantity'], supp_unit['uom_id']) / supp_unit['factor']
                else:
                    vals['supplementary_units'] = None

        return query_results
