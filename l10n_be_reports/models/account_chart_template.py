# -*- coding: utf-8 -*-
from odoo.addons.account.models.chart_template import template
from odoo import models


class AccountChartTemplate(models.AbstractModel):
    _inherit = 'account.chart.template'

    @template('be', 'res.company')
    def _get_be_reports_res_company(self):
        return {
            self.env.company.id: {
                'deferred_expense_account_id': 'a490',
                'deferred_revenue_account_id': 'a493',
            }
        }