# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import models


class AccountChartTemplate(models.AbstractModel):
    _inherit = "account.chart.template"

    def _configure_payroll_account_lt(self, companies):
        account_codes = [
            # YTI TODO: Configure accounts
        ]
        default_account = False
        rules_mapping = defaultdict(dict)

        # ================================================ #
        #          LT Employee Payroll Structure           #
        # ================================================ #

        # YTI TODO: Setup Accounts
        self._configure_payroll_account(
            companies,
            "LT",
            account_codes=account_codes,
            rules_mapping=rules_mapping,
            default_account=default_account)