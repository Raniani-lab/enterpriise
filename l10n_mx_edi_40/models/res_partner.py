# -*- coding: utf-8 -*-

from odoo import api, models, fields
from odoo.addons.l10n_mx_edi.models.res_company import FISCAL_REGIMES_SELECTION

class ResPartner(models.Model):
    _inherit = 'res.partner'

    l10n_mx_edi_fiscal_regime = fields.Selection(
        selection=FISCAL_REGIMES_SELECTION,
        string="Fiscal Regime",
        compute="_compute_l10n_mx_edi_fiscal_regime",
        readonly=False,
        store=True,
        help="Fiscal Regime is required for all partners (used in CFDI)")
    l10n_mx_edi_no_tax_breakdown = fields.Boolean(
        string="No Tax Breakdown",
        help="Includes taxes in the price and does not add tax information to the CFDI. Particularly in handy for IEPS. ")
    country_code = fields.Char(related='country_id.code', string='Country Code')

    @api.depends('country_code')
    def _compute_l10n_mx_edi_fiscal_regime(self):
        for partner in self:
            if not partner.country_code:
                partner.l10n_mx_edi_fiscal_regime = None
            elif partner.country_code != 'MX':
                partner.l10n_mx_edi_fiscal_regime = '616'
            elif not partner.l10n_mx_edi_fiscal_regime:
                partner.l10n_mx_edi_fiscal_regime = '601'

    @api.model
    def get_partner_localisation_fields_required_to_invoice(self, country_id):
        res = super().get_partner_localisation_fields_required_to_invoice(country_id)
        if country_id.code == 'MX':
            res.extend([self.env['ir.model.fields']._get(self._name, 'l10n_mx_edi_fiscal_regime')])
        return res
