# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import UserError


class ECSalesReport(models.AbstractModel):
    _inherit = 'account.sales.report'

    @api.model
    def _get_columns_name(self, options):
        if self._get_report_country_code(options) in self._get_non_generic_country_codes(options):
            # if the report country has a specific report, do not run generic report code
            return super(ECSalesReport, self)._get_columns_name(options)

        return [
            {'name': ''},
            {'name': _('Country Code')},
            {'name': _('VAT')},
            {'name': _('Amount'), 'class': 'number'},
        ]

    def _get_row_columns(self, options, row, ec_sale_code_options_data):
        if self._get_report_country_code(options) in self._get_non_generic_country_codes(options):
            # if the report country has a specific report, do not run generic report code
            return super(ECSalesReport, self)._get_row_columns(options, row, ec_sale_code_options_data)

        return [row['partner_country_code'], row['vat'], row['amount']]

    def _get_options(self, previous_options=None):
        options = super(ECSalesReport, self)._get_options(previous_options)
        if self._get_report_country_code(options) in self._get_non_generic_country_codes(options):
            # country specific reports do not support 'journals' option
            options.pop('journals', None)
        else:
            # the generic report do not support 'ec_sale_code' option and do not display country label
            options.pop('ec_sale_code', None)
            options.pop('country_specific_report_label', None)
        return options

    def _get_partner_amls_domain(self, options, params):
        if self._get_report_country_code(options) in self._get_non_generic_country_codes(options):
            # if the report country has a specific report, do not run generic report code
            return super(ECSalesReport, self)._get_partner_amls_domain(options, params)

        model, model_id = self._get_model_info_from_id(params['id'])
        if model != 'res.partner':
            raise UserError(_("Wrong model on line %s ; expected res.partner", params['id']))

        return [
            ('move_id.move_type', 'in', ('out_invoice', 'out_refund')),
            ('partner_id', '=', model_id),
            ('move_id.date', '>=', options['date']['date_from']),
            ('move_id.date', '<=', options['date']['date_to']),
            ('partner_id.country_id.code', 'in', tuple(self.env['account.sales.report'].get_ec_country_codes(options))),
            ('account_id.internal_type', '=', 'receivable'),
            ('partner_id.country_id', '!=', self.env.company.account_fiscal_country_id.id),
            ('partner_id.vat', '!=', False),
        ]

    @api.model
    def _prepare_query(self, options):
        if self._get_report_country_code(options) in self._get_non_generic_country_codes(options):
            # if the report country has a specific report, do not run generic report code
            return super(ECSalesReport, self)._prepare_query(options)

        tables, where_clause, where_params = self._query_get(options, [(
            'move_id.move_type', 'in', ('out_invoice', 'out_refund'))
        ])
        where_params.append(tuple(self.env['account.sales.report'].get_ec_country_codes(options)))
        query = '''
                SELECT partner.id AS partner_id,
                       partner.vat AS vat,
                       partner.name AS partner_name,
                       country.code AS partner_country_code,
                       sum(account_move_line.balance) AS amount
                  FROM ''' + tables + '''
             LEFT JOIN res_partner partner ON account_move_line.partner_id = partner.id
             LEFT JOIN res_country country ON partner.country_id = country.id
             LEFT JOIN account_account account on account_move_line.account_id = account.id
             LEFT JOIN res_company company ON account_move_line.company_id = company.id
            INNER JOIN res_partner company_partner ON company_partner.id = company.partner_id
                 WHERE ''' + where_clause + '''
                   AND country.code IN %s
                   AND account.internal_type = 'receivable'
                   AND company_partner.country_id != country.id
                   AND partner.vat IS NOT NULL
              GROUP BY partner.id, partner.vat, partner.name, country.code
        '''
        return query, where_params
