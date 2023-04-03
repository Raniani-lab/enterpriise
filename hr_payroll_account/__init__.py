#-*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models
from . import report


def _hr_payroll_account_post_init(env):
    for company in env['res.company'].search([('chart_template', '!=', False)]):
        ChartTemplate = env['account.chart.template'].with_company(company)
        ChartTemplate._load_data({
            'account.journal': ChartTemplate._get_payroll_account_journal(company.chart_template),
            'hr.payroll.structure': ChartTemplate._get_payroll_structure(company.chart_template),
        })
