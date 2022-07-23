# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class ReportCertificationReportIva(models.Model):
    _inherit = 'account.report'

    def _l10n_co_reports_iva_get_query_results(self, options, domain, bimestre=False):
        queries = []
        params = []
        for column_group_key, column_group_options in self._split_options_per_column_group(options).items():

            tables, where_clause, where_params = self._query_get(column_group_options, 'strict_range', domain=domain)
            queries.append(f"""
                SELECT
                    %s AS column_group_key,
                    SUM(CASE
                        WHEN aa.code LIKE '2408%%'
                            THEN account_move_line.credit - account_move_line.debit
                        ELSE 0
                        END
                     ) AS balance_15_over_19,
                    SUM(CASE
                        WHEN aa.code NOT LIKE '2408%%'
                            THEN account_move_line.credit - account_move_line.debit
                        ELSE 0
                        END
                    ) AS balance,
                    SUM(CASE
                        WHEN aa.code NOT LIKE '2408%%' AND account_move_line.credit > 0
                            THEN account_move_line.tax_base_amount
                        WHEN aa.code NOT LIKE '2408%%' AND account_move_line.debit > 0
                            THEN account_move_line.tax_base_amount * -1
                        ELSE 0
                        END
                    ) AS tax_base_amount,
                    {bimestre and 'CAST(FLOOR((EXTRACT(MONTH FROM account_move_line.date) + 1) / 2) AS INT) AS bimestre,' or ''}
                    rp.id AS partner_id,
                    rp.name AS partner_name
                FROM {tables}
                JOIN res_partner rp ON account_move_line.partner_id = rp.id
                JOIN account_account aa ON account_move_line.account_id = aa.id
                WHERE {where_clause}
                GROUP BY rp.id {bimestre and ', CAST(FLOOR((EXTRACT(MONTH FROM account_move_line.date) + 1) / 2) AS INT)' or ''}
            """)
            params += [column_group_key, *where_params]

        self._cr.execute(' UNION ALL '.join(queries), params)
        return self._cr.dictfetchall()

    def _l10n_co_reports_iva_get_domain(self, options, line_dict_id=None):
        domain = super()._l10n_co_reports_get_domain(options, line_dict_id=line_dict_id)
        domain += ['|', ('account_id.code', '=like', '2367%'), ('account_id.code', '=like', '2408%')]
        return domain

    def _l10n_co_reports_iva_get_dynamic_lines(self, options, all_column_groups_expression_totals):
        domain = self._l10n_co_reports_iva_get_domain(options)
        query_results = self._l10n_co_reports_iva_get_query_results(options, domain)
        return super()._l10n_co_reports_get_partner_values(options, query_results, 'l10n_co_reports_iva_expand_function')

    def l10n_co_reports_iva_expand_function(self, line_dict_id, groupby, options, progress, offset, unfold_all_batch_data=None):
        domain = self._l10n_co_reports_iva_get_domain(options, line_dict_id=line_dict_id)
        query_results = self._l10n_co_reports_iva_get_query_results(options, domain, bimestre=True)
        return super()._l10n_co_reports_get_grouped_values(options, query_results, group_by='bimestre')
