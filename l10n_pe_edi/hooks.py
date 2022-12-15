# Part of Odoo. See LICENSE file for full copyright and licensing details.

def post_init_hook(env):
    pe_companies = env['res.company'].search([('partner_id.country_id.code', '=', 'PE')])
    pe_taxes = env['account.tax'].search([('company_id', 'in', pe_companies.ids), ('type_tax_use', '=', 'sale')])
    pe_taxes._compute_l10n_pe_edi_affectation_reason()
