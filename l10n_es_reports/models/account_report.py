# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _
from odoo.exceptions import UserError


MOD_347_CUSTOM_ENGINES_DOMAINS = {
    'l10n_es_mod347_threshold_insurance_bought': [
        ('move_id.l10n_es_reports_mod347_invoice_type', '=', 'insurance'),
        ('move_id.move_type', 'in', ('in_invoice', 'in_refund')),
        ('account_type', '=', 'liability_payable'),
    ],

    'l10n_es_mod347_threshold_regular_bought': [
        ('move_id.l10n_es_reports_mod347_invoice_type', '=', 'regular'),
        ('move_id.move_type', 'in', ('in_invoice', 'in_refund')),
        ('account_type', '=', 'liability_payable'),
    ],

    'l10n_es_mod347_threshold_regular_sold': [
        ('move_id.l10n_es_reports_mod347_invoice_type', '=', 'regular'),
        ('move_id.move_type', 'in', ('out_invoice', 'out_refund')),
        ('account_type', '=', 'asset_receivable'),
    ],

    'l10n_es_mod347_threshold_all_operations': [
        ('move_id.l10n_es_reports_mod347_invoice_type', '!=', None),
        ('account_type', 'in', ('asset_receivable', 'liability_payable'))
    ],
}

class AccountReport(models.Model):
    _inherit = 'account.report'

    def _custom_engine_l10n_es_mod347_threshold_insurance_bought(self, expressions, options, date_scope, current_groupby, next_groupby, offset=0, limit=None, order=None):
        domain = MOD_347_CUSTOM_ENGINES_DOMAINS['l10n_es_mod347_threshold_insurance_bought']
        return self._l10n_es_mod347_custom_threshold_common(domain, expressions, options, date_scope, current_groupby, next_groupby,
                                                            offset=offset, limit=limit, order=order)

    def _custom_engine_l10n_es_mod347_threshold_regular_bought(self, expressions, options, date_scope, current_groupby, next_groupby, offset=0, limit=None, order=None):
        domain = MOD_347_CUSTOM_ENGINES_DOMAINS['l10n_es_mod347_threshold_regular_bought']
        return self._l10n_es_mod347_custom_threshold_common(domain, expressions, options, date_scope, current_groupby, next_groupby,
                                                            offset=offset, limit=limit, order=order)

    def _custom_engine_l10n_es_mod347_threshold_regular_sold(self, expressions, options, date_scope, current_groupby, next_groupby, offset=0, limit=None, order=None):
        domain = MOD_347_CUSTOM_ENGINES_DOMAINS['l10n_es_mod347_threshold_regular_sold']
        return self._l10n_es_mod347_custom_threshold_common(domain, expressions, options, date_scope, current_groupby, next_groupby,
                                                            offset=offset, limit=limit, order=order)

    def _custom_engine_l10n_es_mod347_threshold_all_operations(self, expressions, options, date_scope, current_groupby, next_groupby, offset=0, limit=None, order=None):
        domain = MOD_347_CUSTOM_ENGINES_DOMAINS['l10n_es_mod347_threshold_all_operations']
        return self._l10n_es_mod347_custom_threshold_common(domain, expressions, options, date_scope, current_groupby, next_groupby,
                                                            offset=offset, limit=limit, order=order)

    def _l10n_es_mod347_custom_threshold_common(self, domain, expressions, options, date_scope, current_groupby, next_groupby, offset=0, limit=None, order=None):
        """ Some lines of mod 347 report need to be grouped by partner, only keeping the partners whose balance for the line is above 3005.06€.
        This function serves as a common helper to the custom engines handling these lines.
        """
        self._check_groupby_fields((next_groupby.split(',') if next_groupby else []) + ([current_groupby] if current_groupby else []))

        # First get all the partners that match the domain but don't reach the threshold. We'll have to exclude them
        ct_query = self.env['res.currency']._get_query_currency_table(options)
        tables, where_clause, where_params = self._query_get(options, date_scope, domain=domain + options.get('forced_domain', []))
        threshold_value = self._convert_threshold_to_company_currency(3005.06, options)
        partners_to_exclude_params = [*where_params, threshold_value]
        partners_to_exclude_query = f"""
            SELECT account_move_line.partner_id
            FROM {tables}
            JOIN {ct_query} ON currency_table.company_id = account_move_line.company_id
            WHERE {where_clause}
            GROUP BY account_move_line.partner_id
            HAVING(SUM(currency_table.rate * account_move_line.balance) <= %s)
        """

        self._cr.execute(partners_to_exclude_query, partners_to_exclude_params)
        partner_ids_to_exclude = [partner_id for (partner_id,) in self._cr.fetchall()]

        # Then, compute the domain, ensuring we esclude the partners who don't reach the threshold
        new_domain = domain + [('partner_id', 'not in', partner_ids_to_exclude)]
        domain_formulas_dict = {str(new_domain): expressions}
        domain_result = self._compute_formula_batch_with_engine_domain(options, date_scope, domain_formulas_dict, current_groupby, next_groupby,
                                                                       offset=0, limit=None)
        return next(result for result in domain_result.values())

    def _convert_threshold_to_company_currency(self, threshold, options):
        """ Returns a EUR threshold to company currency, using the options' date_to for conversion
        """
        threshold_currency = self.env.ref('base.EUR')

        if not threshold_currency.active:
            raise UserError(_("Currency %s, used for a threshold in this report, is either nonexistent or inactive. Please create or activate it.", threshold_currency.name))

        company_currency = self.env.company.currency_id
        return threshold_currency._convert(threshold, company_currency, self.env.company, options['date']['date_to'])

    def _get_expression_audit_aml_domain(self, expression, options):
        # Overridden to allow auditing mod347's threshold lines (for consistency: this way all the lines of the report are audited in the same way)
        if expression.engine == 'custom' and expression.formula in MOD_347_CUSTOM_ENGINES_DOMAINS:
            return MOD_347_CUSTOM_ENGINES_DOMAINS[expression.formula]
        else:
            return super()._get_expression_audit_aml_domain(expression, options)
