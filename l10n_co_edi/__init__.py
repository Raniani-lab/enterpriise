# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from . import models
from . import wizards


def _setup_tax_type(env):
    companies = env['res.company'].search([('chart_template', '=', 'co')])
    for company in companies:
        Template = env['account.chart.template'].with_company(company)
        for xml_id, tax_data in Template._get_co_edi_account_tax().items():
            tax = Template.ref(xml_id, raise_if_not_found=False)
            if tax and 'l10n_co_edi_type' in tax_data:
                tax.l10n_co_edi_type = tax_data['l10n_co_edi_type']

def _l10n_co_edi_post_init(env):
    _setup_tax_type(env)
