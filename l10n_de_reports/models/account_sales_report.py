# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import math
import tempfile
import zipfile

from odoo import _, api, models


class ECSalesReport(models.Model):
    _inherit = 'account.report'

    def _custom_options_initializer_l10n_de_sales_report(self, options, previous_options=None):
        """
        Add the invoice lines search domain that is specific to the country.
        Typically, the taxes account.report.expression ids relative to the country for the triangular, sale of goods
        or services.
        :param dict options: Report options
        :return dict: The modified options dictionary
        """
        self.ensure_one()
        self._sales_report_init_core_custom_options(options, previous_options)
        ec_operation_category = options.get('sales_report_taxes', {'goods': tuple(), 'triangular': tuple(), 'services': tuple()})

        ec_operation_category['goods'] = tuple(self.env.ref('l10n_de.tax_report_de_tag_41_tag')._get_matching_tags().ids)
        ec_operation_category['triangular'] = tuple(self.env.ref('l10n_de.tax_report_de_tag_42_tag')._get_matching_tags().ids)
        ec_operation_category['services'] = tuple(self.env.ref('l10n_de.tax_report_de_tag_68_tag')._get_matching_tags().ids)

        # Change the names of the taxes to specific ones that are dependant to the tax type
        ec_operation_category['operation_category'] = {
            'goods': 'L',
            'triangular': 'D',
            'services': 'S',
        }

        options.update({'sales_report_taxes': ec_operation_category})

        # Buttons

        options.setdefault('buttons', []).append({
            'name': _('CSV'),
            'sequence': 30,
            'action': 'export_file',
            'action_param': 'l10n_de_datev_print_de_csvs_zip',
            'file_export_type': _('ZIP')
        })

    @api.model
    def l10n_de_datev_get_csvs(self, options):
        options['get_file_data'] = True
        lines = []
        for line in self._get_lines(options)[:-1]:
            l = []
            for column in line['columns']:
                l.append(column['no_format'])
            lines.append(tuple(l))
        # each csv file may only contain up to 1000 lines
        line_chunks = []
        chunks = [lines[i * 1000:(i + 1) * 1000] for i in range(math.ceil(len(lines) / 1000))]
        for chunk in chunks:
            content = 'Länderkennzeichen,USt-IdNr.,Betrag (Euro),Art der Leistung\n'
            for val in chunk:
                content += ','.join([val[0], val[1], str(val[3]), val[2]]) + '\n'
            line_chunks.append(content)
        return line_chunks

    def l10n_de_datev_print_de_csvs_zip(self, options):
        csvs = self.l10n_de_datev_get_csvs(options)
        with tempfile.NamedTemporaryFile() as buf:
            with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED, allowZip64=False) as zip_buffer:
                for i, csv in enumerate(csvs):
                    zip_buffer.writestr('EC_Sales_list%s.csv' % (len(csvs) > 1 and ("_" + str(i+1)) or ""), csv)
            buf.seek(0)
            res = buf.read()
        return {
            'file_name': self.get_default_report_filename('ZIP'),
            'file_content': res,
            'file_type': 'zip'
        }
