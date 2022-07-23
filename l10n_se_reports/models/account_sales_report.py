# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import contextlib
import io
from collections import defaultdict
from odoo import _, api, fields, models
from odoo.exceptions import UserError
from odoo.tools import pycompat, date_utils


class ECSalesReport(models.Model):
    _inherit = "account.report"

    def _custom_options_initializer_l10n_se_sales_report(self, options, previous_options=None):
        """
        Called in _sales_report_init_core_custom_options to add the invoice lines search domain that is specific to the
        country.
        Typically, the taxes account.report.expression ids relative to the country for the triangular, sale of goods
        or services.
        :param dict options: Report options
        :param dict previous_options: Previous report options
        :return dict[Any]: The modified options dictionary
        """
        self.ensure_one()
        self._sales_report_init_core_custom_options(options, previous_options)
        ec_operation_category = options.get('sales_report_taxes', {'goods': tuple(), 'triangular': tuple(), 'services': tuple()})

        ec_operation_category['goods'] = tuple(self.env.ref('l10n_se.tax_report_line_35_tag')._get_matching_tags().ids)
        ec_operation_category['triangular'] = tuple(self.env.ref('l10n_se.tax_report_line_38_tag')._get_matching_tags().ids)
        ec_operation_category['services'] = tuple(self.env.ref('l10n_se.tax_report_line_39_tag')._get_matching_tags().ids)
        options.update({'sales_report_taxes': ec_operation_category})

        # Buttons
        options.setdefault('buttons', []).append({
            'name': _('KVR'),
            'sequence': 60,
            'action': 'export_file',
            'action_param': 'l10n_se_export_sales_report_to_kvr',
            'file_export_type': _('KVR'),
            'active': self.country_id.code in ('SE', None),
        })

    def _dynamic_lines_generator_l10n_se_sales_report(self, options, all_column_groups_expression_totals):
        """
        Generate the dynamic lines for the report in a horizontal style
        (one line partner, one column per operation type).
        """
        self.ensure_one()
        lines = []

        totals_by_column_group = {
            column_group_key: {
                "goods": 0.0,
                "triangular": 0.0,
                "services": 0.0,
            }
            for column_group_key in options['column_groups']
        }
        for partner, results in self._sales_report_query_partners(options):
            partner_values = defaultdict(dict)
            for column_group_key in options['column_groups']:
                partner_sum = results.get(column_group_key, {})
                partner_values[column_group_key]['goods'] = partner_sum.get('goods', 0.0)
                partner_values[column_group_key]['triangular'] = partner_sum.get('triangular', 0.0)
                partner_values[column_group_key]['services'] = partner_sum.get('services', 0.0)
                partner_values[column_group_key]['vat_number'] = partner_sum.get('full_vat_number', 'UNKNOWN')
                if not totals_by_column_group[column_group_key].get('vat_number'):
                    totals_by_column_group[column_group_key]['vat_number'] = ''
                totals_by_column_group[column_group_key]['goods'] += partner_sum.get('goods', 0.0)
                totals_by_column_group[column_group_key]['triangular'] += partner_sum.get('triangular', 0.0)
                totals_by_column_group[column_group_key]['services'] += partner_sum.get('services', 0.0)
            lines.append((0, self._sales_report_get_report_line_partner(options, partner, partner_values)))
        # Report total line.
        lines.append((0, self._sales_report_get_report_line_total(options, totals_by_column_group)))
        return lines

    @api.model
    def _l10n_se_reports_get_se_period(self, options):
        """
        Ensures that the period is in the correct format for the exporting format.
        """
        date_to = fields.Date.from_string(options['date'].get('date_to'))
        if options['date']['period_type'] == 'month':
            return date_to.strftime('%y%m')
        if options['date']['period_type'] == 'quarter':
            return '%s-%s' % (date_to.strftime('%y'), date_utils.get_quarter_number(date_to))
        raise UserError(_('You can only export Monthly or Quarterly reports.'))

    def l10n_se_export_sales_report_to_kvr(self, options):
        """
        Collect the data for the KVR report.
        """
        options['get_file_data'] = True
        lines = [
            ['SKV574008'],
            [
                self.env.company.vat,
                self._l10n_se_reports_get_se_period(options),
                self.env.user.name,
                self.env.user.phone or '',
                self.env.user.email or '',
                ''
            ],
        ]
        currency = self.env.company.currency_id

        for data_line in self._get_lines(options)[:-1]:  # [:-1] to skip total line
            columns = []
            for column in data_line['columns']:
                if not (isinstance(column.get('no_format'), (int, float)) and currency.is_zero(column.get('no_format', 0))):
                    columns.append(column.get('no_format', ''))
                else:
                    columns.append('')
            lines.append(columns)
        with contextlib.closing(io.BytesIO()) as buf:
            writer = pycompat.csv_writer(buf, delimiter=';')
            writer.writerows(lines)
            content = buf.getvalue()
        return {
            'file_name': self.get_default_report_filename('KVR'),
            'file_content': content,
            'file_type': 'csv',  # KVR is just csv with extra steps
        }
