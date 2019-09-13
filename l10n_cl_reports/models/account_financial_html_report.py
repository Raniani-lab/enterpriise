# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _


class AccountFinancialHtmlReport(models.Model):
    _inherit = 'account.financial.html.report'

    @api.model
    def _get_options(self, previous_options=None):
        tasa_ppm = self.env.context.get('tasa_ppm')
        if tasa_ppm:
            context_values = {
                'tasa_ppm': tasa_ppm
            }
            self = self.with_context(
                financial_report_line_values=context_values
            )
        return super(AccountFinancialHtmlReport, self._with_correct_filters()
                     )._get_options(previous_options)
