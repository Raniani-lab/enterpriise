# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo import models


class ReportCertificationReport(models.Model):
    _inherit = 'account.report'

    def _l10n_co_reports_custom_options_initializer(self, options, previous_options=None):
        for button in options['buttons']:
            if button['name'] == 'PDF':
                button['action'] = 'l10n_co_reports_print_pdf'

    def _l10n_co_reports_get_column_values(self, options, grouped_values):
        """ Retrieve the correct value for each column and format it accordingly.
        This method is used by several reports, and some columns only apply to
        one or more report(s), i.e 'percentage' and 'bimestre'.

        :param options (dict):      The report options.
        :param values (dict):       All the values for the current line.
        :return (list of dicts):    A list of dicts, with each dict representing a column.
        """
        column_values = []

        for column in options['columns']:
            col_expr = column['expression_label']
            current_value = grouped_values.get(column['column_group_key'], {})

            if not current_value:
                column_values.append({})
            else:
                col_val = current_value.get(col_expr)
                col_class = ''
                if col_expr == 'percentage':
                    col_name = col_val = 0.15 if current_value['balance'] else 0
                    col_class = 'number'
                else:
                    if col_val is None:
                        column_values.append({})
                        continue
                    else:
                        if col_expr == 'bimestre':
                            col_name = col_val = self._l10n_co_reports_get_bimonth_name(current_value['bimestre'])
                        else:
                            col_name = self.format_value(col_val, figure_type=column['figure_type'], blank_if_zero=False)
                            col_class = 'number'

                column_values.append({
                    'name': col_name,
                    'no_format': col_val,
                    'class': col_class,
                })

        return column_values

    def _l10n_co_reports_get_partner_values(self, options, query_results, expand_function):
        grouped_results = {}
        for results in query_results:
            grouped_results.setdefault(results['partner_id'], {})[results['column_group_key']] = results

        lines = []
        for partner_id, partner_values in grouped_results.items():
            line_id = self._get_generic_line_id('res.partner', partner_id)
            lines.append((0, {
                'id': line_id,
                'name': list(partner_values.values())[0]['partner_name'],
                'level': 2,
                'unfoldable': True,
                'unfolded': line_id in options.get('unfolded_lines'),
                'expand_function': expand_function,
                'columns': self._l10n_co_reports_get_column_values(options, partner_values)
            }))
        return lines

    def _l10n_co_reports_get_grouped_values(self, options, query_results, group_by=None):
        grouped_results = {}
        for results in query_results:
            grouped_results.setdefault(results[group_by], {})[results['column_group_key']] = results

        lines = []
        for group, group_values in grouped_results.items():
            parent_line_id = self._get_generic_line_id('res.partner', list(group_values.values())[0]['partner_id'])
            markup = '%s_%s' % (group_by, group)
            lines.append({
                'id': self._get_generic_line_id(None, None, markup=markup, parent_line_id=parent_line_id),
                'name': '',
                'unfoldable': False,
                'columns': self._l10n_co_reports_get_column_values(options, group_values),
                'level': 3,
                'parent_id': parent_line_id,
            })
        return {'lines': lines}

    def _l10n_co_reports_get_bimonth_name(self, bimonth_index):
        bimonth_names = {
            1: 'Enero - Febrero',
            2: 'Marzo - Abril',
            3: 'Mayo - Junio',
            4: 'Julio - Agosto',
            5: 'Septiembre - Octubre',
            6: 'Noviembre - Diciembre',
        }
        return bimonth_names[bimonth_index]

    def _l10n_co_reports_get_domain(self, options, line_dict_id=None):
        common_domain = [('partner_id', '!=', False)]
        if line_dict_id:
            partner_model, partner_id = self._get_model_info_from_id(line_dict_id)
            if partner_model == 'res.partner' and partner_id:
                common_domain += [('partner_id', '=', partner_id)]
        return common_domain

    def l10n_co_reports_print_pdf(self, options, action_param):
        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'l10n_co_reports.retention_report.wizard',
            'views': [(self.env.ref('l10n_co_reports.retention_report_wizard_form').id, 'form')],
            'view_id': self.env.ref('l10n_co_reports.retention_report_wizard_form').id,
            'target': 'new',
            'context': {'options': options},
            'data': {'options': json.dumps(options), 'output_format': 'pdf'},
        }
