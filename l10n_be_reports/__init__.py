# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models
from . import wizard
from . import report


def _l10n_be_reports_post_init(env):
    for company in env['res.company'].search([('chart_template', '=', 'be')]):
        ChartTemplate = env['account.chart.template'].with_company(company)
        ChartTemplate._load_data({
            'res.company': ChartTemplate._get_be_reports_res_company(company.chart_template),
        })
