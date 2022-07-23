# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _
from odoo.addons.l10n_eu_oss.models.eu_tax_map import EU_TAX_MAP
from odoo.exceptions import UserError

from collections import defaultdict
from lxml import etree, objectify


class AccountReport(models.Model):
    _inherit = 'account.report'

    availability_condition = fields.Selection(selection_add=[('oss', "Using OSS")])

    def _is_available_for(self, options):
        # Overridden to support 'oss' availability condition
        if self.availability_condition == 'oss':
            oss_tag = self.env.ref('l10n_eu_oss.tag_oss')
            company_ids = [company_opt['id'] for company_opt in options.get('multi_company', [])] or self.env.company.ids
            return bool(self.env['account.tax.repartition.line']\
                        .search([('tag_ids', 'in', oss_tag.ids), ('company_id', 'in', company_ids)], limit=1))
        else:
            return super()._is_available_for(options)

    def _custom_options_initializer_oss_sales(self, options, previous_options=None):
        options['forced_domain'] = [
            *options.get('forced_domain', []),
            ('tax_tag_ids', 'in', self.env.ref('l10n_eu_oss.tag_oss').ids),
            ('tax_tag_ids', 'not in', self.env.ref('l10n_eu_oss.tag_eu_import').ids),
        ]
        self._oss_common_custom_options_initializer(options, previous_options=previous_options)

    def _oss_imports_custom_options_initializer(self, options, previous_options=None):
        options['forced_domain'] = [
            *options.get('forced_domain', []),
            ('tax_tag_ids', 'in', self.env.ref('l10n_eu_oss.tag_oss').ids),
            ('tax_tag_ids', 'in', self.env.ref('l10n_eu_oss.tag_eu_import').ids),
        ]
        self._oss_common_custom_options_initializer(options, previous_options=previous_options)

    def _oss_common_custom_options_initializer(self, options, previous_options=None):
        # Add OSS XML export if there is one available for the domestic country
        if self._get_oss_xml_template(options):
            options.setdefault('buttons', []).append({
                'name': _('XML'),
                'sequence': 3,
                'action': 'export_file',
                'action_param': '_oss_export_to_xml',
                'file_export_type': _('XML'),
            })

    def _dynamic_lines_generator_oss_report(self, options, all_column_groups_expression_totals):
        """ The country for OSS taxes can't easily be guessed from SQL, as it would create JOIN issues.
        So, instead of handling them as a grouping key in the tax report engine, we
        post process the result of a grouping made by (type_tax_use, id) to inject the
        grouping by country.
        """
        def append_country_and_taxes_lines(parent_line, rslt, tax_lines_by_country):
            for country, tax_lines in sorted(tax_lines_by_country.items(), key=lambda elem: elem[0].display_name):
                col_number = len(tax_lines[0]['columns']) if tax_lines else 0
                tax_sums = [
                    sum(tax_lines[line_index]['columns'][col_index]['no_format'] for line_index in range(len(tax_lines)))
                    for col_index in range(1, col_number, 2)
                ]

                country_columns = []
                for tax_sum in tax_sums:
                    country_columns += [{'name': ''}, {'no_format': tax_sum, 'name': self.format_value(tax_sum, figure_type='monetary')}]

                country_line_id = self._get_generic_line_id('res.country', country.id, parent_line_id=parent_line['id'])
                country_line = {
                    'id': country_line_id,
                    'name': country.display_name,
                    'parent_id': parent_line['id'],
                    'columns': country_columns,
                    'unfoldable': False,
                    'level': 2,
                }

                rslt.append((0, country_line))

                for tax_line in tax_lines:
                    tax_line['parent_id'] = country_line_id
                    tax_line['level'] = 3
                    tax_parsed_id = self._parse_line_id(tax_line['id'])[-1]
                    tax_line['id'] = self._get_generic_line_id(
                        markup=tax_parsed_id[0],
                        model_name=tax_parsed_id[1],
                        value=tax_parsed_id[2],
                        parent_line_id=country_line['id']
                    )
                    rslt.append((0, tax_line))

        lines = self._dynamic_lines_generator_generic_tax_report(options, all_column_groups_expression_totals)

        rslt = []
        tax_type_markups = {'sale', 'purchase'}
        tax_lines_by_country = defaultdict(lambda: [])
        last_tax_type_line = None
        for (dummy, line) in lines:
            markup, model, model_id = self._parse_line_id(line['id'])[-1]

            if markup in tax_type_markups:
                last_tax_type_line = line

                # Then it's a type_tax_use_section
                # If there were tax lines for the previous section, append them to rslt; the previous section is over
                append_country_and_taxes_lines(line, rslt, tax_lines_by_country)

                # Start next section
                rslt.append((0, line))
                tax_lines_by_country = defaultdict(lambda: [])

            elif model == 'account.tax':
                # line is a tax line
                tax = self.env['account.tax'].browse(model_id)
                tax_oss_country = self.env['account.fiscal.position.tax'].search([('tax_dest_id', '=', tax.id)])\
                                                                         .mapped('position_id.country_id')

                if not tax_oss_country:
                    raise UserError(_("OSS tax %s is not mapped in any fiscal position with a country set.", tax.display_name))
                elif len(tax_oss_country) > 1:
                    raise UserError(_("Inconsistent setup: OSS tax %s is mapped in fiscal positions from different countries.", tax.display_name))

                tax_lines_by_country[tax_oss_country].append(line)

        # Append the tax and country lines for the last section
        append_country_and_taxes_lines(last_tax_type_line, rslt, tax_lines_by_country)

        return rslt

    def _oss_export_to_xml(self, options):
        self.ensure_one()
        oss_import_report = self.env.ref('l10n_eu_oss_reports.oss_imports_report')
        eu_countries = self.env.ref('base.europe').country_ids
        date_to = fields.Date.from_string(options['date']['date_to'])
        month = None
        quarter = None

        if options['date']['period_type'] == 'month':
            month = date_to.month
        elif options['date']['period_type'] == 'quarter':
            month_end = int(date_to.month)
            quarter = month_end // 3
        else:
            raise UserError(_('Choose a month or quarter to export the OSS report'))

        # prepare a dict of european standard tax rates {'AT': 20.0, 'BE': 21.0 ... }
        # sorted() is here needed to ensure the dict will contain the hihest rate each time
        eu_standard_rates = {source_code: rate for source_code, rate, target_code in sorted(EU_TAX_MAP.keys())}
        tax_scopes = dict(self.env['account.tax'].fields_get()['tax_scope']['selection'])
        sender_company = self._get_sender_company_for_export(options)

        lines = self._get_lines(options)
        data = {}
        current_country = None
        for line in lines:
            model, model_id = self._get_model_info_from_id(line['id'])

            if model == 'res.country':
                current_country = self.env['res.country'].browse(model_id)
                data[current_country] = []

            elif model == 'account.tax':
                tax = self.env['account.tax'].browse(model_id)
                data[current_country].append({
                    'tax': tax,
                    'net_amt': line['columns'][0]['no_format'],
                    'tax_amt': line['columns'][1]['no_format'],
                    'currency': sender_company.currency_id,
                    'supply_type': tax_scopes[tax.tax_scope].upper() if tax.tax_scope else 'GOODS',
                    'rate_type': 'STANDARD' if tax.amount == eu_standard_rates[current_country.code] else 'REDUCED',
                })

        values = {
            'VATNumber': sender_company.vat if sender_company.account_fiscal_country_id in eu_countries else None,
            'VoesNumber': sender_company.voes if sender_company.account_fiscal_country_id not in eu_countries else None,
            'IOSSNumber': sender_company.ioss if self == oss_import_report else None,
            'IntNumber': sender_company.intermediary_no if self == oss_import_report else None,
            'Year': date_to.year,
            'Quarter': quarter,
            'Month': month,
            'country_taxes': data,
            'creation_timestamp': fields.Datetime.context_timestamp(self, fields.Datetime.now()),
        }

        export_template_ref = self._get_oss_xml_template(options)
        rendered_content = self.env['ir.qweb']._render(export_template_ref, values)
        tree = objectify.fromstring(rendered_content)

        return {
            'file_name': self.get_default_report_filename('xml'),
            'file_content': etree.tostring(tree, pretty_print=True, xml_declaration=True, encoding='utf-8'),
            'file_type': 'xml',
        }

    def _get_oss_xml_template(self, options):
        ''' Used to get the template ref for XML export
        Override this method to include additional templates for other countries
        Also serves as a check to verify if the options selected are conducive to an XML export
        '''
        country_code = self._get_sender_company_for_export(options).account_fiscal_country_id.code
        if country_code == 'BE':
            return 'l10n_eu_oss_reports.eu_oss_generic_export_xml_be'
        if country_code == 'LU':
            return 'l10n_eu_oss_reports.eu_oss_generic_export_xml_lu'

        return None

    def _tax_report_get_vat_closing_entry_additional_domain(self):
        # OVERRIDE
        domain = super()._tax_report_get_vat_closing_entry_additional_domain()
        domain += [
            ('tax_tag_ids', 'not in', self.env.ref('l10n_eu_oss.tag_oss').ids),
        ]
        return domain
