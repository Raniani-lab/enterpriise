# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil.relativedelta import relativedelta
from odoo import models, fields, api, _
from odoo.exceptions import UserError


class ECSalesReport(models.AbstractModel):
    _inherit = 'account.sales.report'

    @api.model
    def _get_report_country_code(self):
        if self.env.company.country_id.code == 'LU':
            return 'LU'
        
        return super(ECSalesReport, self)._get_report_country_code()


    def _get_ec_sale_code_options_data(self):
        if self._get_report_country_code() != 'LU':
            return super(ECSalesReport, self)._get_ec_sale_code_options_data()

        return {
            'goods': {
                'name': 'L',
                'tax_report_line_ids': self.env.ref('l10n_lu.account_tax_report_line_1b_1_intra_community_goods_pi_vat').ids,
            },
            'triangular': {
                'name': 'T',
                'tax_report_line_ids': self.env.ref('l10n_lu.account_tax_report_line_1b_6_a_subsequent_to_intra_community').ids,
            },
            'services': {
                'name': 'S',
                'tax_report_line_ids': self.env.ref('l10n_lu.account_tax_report_line_1b_6_b1_non_exempt_customer_vat').ids,
            },
        }

    @api.model
    def _get_reports_buttons(self):
        if self._get_report_country_code() != 'LU':
            return super(ECSalesReport, self)._get_reports_buttons()

        return super(ECSalesReport, self)._get_reports_buttons() + [
            {'name': _('Export (XML)'), 'sequence': 3, 'action': 'print_xml', 'file_export_type': _('XML')}
        ]

    @api.model
    def _get_columns_name(self, options):
        if self._get_report_country_code() != 'LU':
            return super(ECSalesReport, self)._get_columns_name(options)

        return [
            {'name': ''},
            {'name': _('Country Code')},
            {'name': _('VAT Number')},
            {'name': _('Code')},
            {'name': _('Amount'), 'class': 'number'},
        ]

    @api.model
    def _process_query_result(self, options, query_result):
        if self._get_report_country_code() != 'LU':
            return super(ECSalesReport, self)._process_query_result(options, query_result)

        lines = super(ECSalesReport, self)._process_query_result(options, query_result)

        if not options.get('get_file_data', False):
            return lines
        else:
            l_lines = []
            t_lines = []
            s_lines = []
            l_sum = t_sum = s_sum = 0
            for line in lines:
                if line[2] == 'L':
                    l_sum += line[3]
                    l_lines.append(line)
                elif line[2] == 'T':
                    t_sum += line[3]
                    t_lines.append(line)
                else:
                    s_sum += line[3]
                    s_lines.append(line)
                line[3] = ('%.2f' % line[3]).replace('.', ',')
            return {
                'l_lines': l_lines,
                't_lines': t_lines,
                's_lines': s_lines,
                'l_sum': ('%.2f' % l_sum).replace('.', ','),
                't_sum': ('%.2f' % t_sum).replace('.', ','),
                's_sum': ('%.2f' % s_sum).replace('.', ','),
            }

    @api.model
    def get_report_filename(self, options):
        if self._get_report_country_code() != 'LU':
            return super().get_report_filename(options)

        ''' 000000         X            20200101 T                      120030  01
            └> eCDF prefix └> X for XML └> date  └> date/time separator └> time └> sequence num (we use ms)
        '''
        ecdf_prefix = self.env.company.ecdf_prefix
        date_time = datetime.now().strftime('%Y%m%dT%H%M%S%f')[:-4]
        filename = f'{ecdf_prefix}X{date_time}'
        # `FileReference` element of exported XML must be the same as fileme -> store in options
        options['filename'] = filename
        return filename

    def _get_report_data(self, options):
        date_from = options['date'].get('date_from')
        date_to = options['date'].get('date_to')

        dt_from = fields.Date.from_string(date_from)
        dt_to = fields.Date.from_string(date_to)

        month = None
        quarter = None

        # dt_from is 1st day of months 1,4,7 or 10 and dt_to is last day of dt_from month+2
        if dt_from.day == 1 and dt_from.month % 3 == 1 and dt_to == dt_from + relativedelta(day=31, month=dt_from.month + 2):
            quarter = int((dt_from.month + 2) / 3)
        # dt_from is 1st day & dt_to is last day of same month
        elif dt_from.day == 1 and dt_from + relativedelta(day=31) == dt_to:
            month = date_from[5:7]
        else:
            raise UserError(_('Check from/to dates. XML must cover 1 full month or 1 full quarter.'))

        year = date_from[:4]

        options['get_file_data'] = True
        xml_data = self.with_context(no_format=True)._get_lines(options)

        return xml_data, month, quarter, year

    @api.model
    def get_xml(self, options):
        if self._get_report_country_code() != 'LU':
            return super().get_xml(options)
        # Check
        company = self.env.company
        errors = []
        self._lu_validate_ecdf_prefix()
        company_vat = company.partner_id.vat
        if not company_vat:
            errors.append(_('VAT'))
        matr_number = company.matr_number
        if not matr_number:
            errors.append(_('Matr Number'))
        if errors:
            raise UserError(_('The following must be set on your company:\n- %s', ('\n- '.join(errors))))

        rcs_number = company.company_registry or 'NE'

        file_ref = options['filename']
        company_vat = company_vat.replace(' ', '').upper()[2:]

        xml_data, month, quarter, year = self._get_report_data(options)

        xml_data.update({
            "file_ref": file_ref,
            "matr_number": matr_number,
            "rcs_number": rcs_number,
            "company_vat": company_vat,
            "year": year,
            "period": month or quarter,
            "type_labes": month and ['TVA_LICM', 'TVA_PSIM'] or ['TVA_LICT', 'TVA_PSIT'],
        })

        rendered_content = self.env['ir.qweb']._render('l10n_lu_reports.EcSalesLuXMLReport', xml_data)
        return b"<?xml version='1.0' encoding='utf-8'?>" + rendered_content
