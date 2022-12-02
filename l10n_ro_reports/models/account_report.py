# -*- coding: utf-8 -*-
"""
Part of Odoo. See LICENSE file for full copyright and licensing details.
"""

from odoo import models


class ReportAccountFinancialReport(models.AbstractModel):
    _name = "l10n_ro.report.handler"
    _inherit = "account.report.custom.handler"
    _description = "Report custom handler for romanian financial reports"

    def _custom_options_initializer(self, report, options, previous_options=None):
        """
        Override the default filter_comparison property to make Romanian reports
         comparing to the last period by default
        :return : Either the default or the previous period filter
        :rtype: dict[str, str or int]
        """
        super()._custom_options_initializer(report, options, previous_options=previous_options)
        options['comparison'] = {
            'date_from': '',
            'date_to': '',
            'filter': "previous_period",
            'number_period': 1
        }
