# coding: utf-8
from .extra_timezones import TIEMPO_DEL_CENTRO_ZIPCODES, TIEMPO_DEL_CENTRO_EN_FRONTIERA_ZIPCODES

from pytz import timezone

from odoo import api, fields, models, _
from odoo.addons.l10n_mx_edi.models.res_company import FISCAL_REGIMES_SELECTION


class ResPartner(models.Model):
    _inherit = 'res.partner'

    # == Addenda ==
    l10n_mx_edi_addenda = fields.Many2one(
        comodel_name='ir.ui.view',
        string="Addenda",
        help="A view representing the addenda",
        domain=[('l10n_mx_edi_addenda_flag', '=', True)])
    l10n_mx_edi_addenda_doc = fields.Html(
        string="Addenda Documentation",
        help="How should be done the addenda for this customer (try to put human readable information here to help the "
             "invoice people to fill properly the fields in the invoice)")

    l10n_mx_edi_fiscal_regime = fields.Selection(
        selection=FISCAL_REGIMES_SELECTION,
        string="Fiscal Regime",
        compute="_compute_l10n_mx_edi_fiscal_regime",
        readonly=False,
        store=True,
        help="Fiscal Regime is required for all partners (used in CFDI)")
    l10n_mx_edi_no_tax_breakdown = fields.Boolean(
        string="No Tax Breakdown",
        help="Includes taxes in the price and does not add tax information to the CFDI. Particularly in handy for IEPS.")

    @api.depends('country_code')
    def _compute_l10n_mx_edi_fiscal_regime(self):
        for partner in self:
            if not partner.country_code:
                partner.l10n_mx_edi_fiscal_regime = None
            elif partner.country_code != 'MX':
                partner.l10n_mx_edi_fiscal_regime = '616'
            elif not partner.l10n_mx_edi_fiscal_regime:
                partner.l10n_mx_edi_fiscal_regime = '601'

    def _l10n_mx_edi_get_cfdi_timezone(self):
        self.ensure_one()
        code = self.state_id.code
        zipcode = self.zip

        # northwest area
        if code == 'BCN':
            return timezone('America/Tijuana') # UTC-8 (-7 DST)
        # Southeast area
        elif code == 'ROO':
            return timezone('America/Bogota') # UTC-5
        # East Chihuahua
        elif code == 'CHH' and zipcode in TIEMPO_DEL_CENTRO_EN_FRONTIERA_ZIPCODES:
            return timezone('America/Boise') # UTC-7 (-6 DST)
        # Tiempo del centro areas
        elif code == 'NAY' and zipcode in TIEMPO_DEL_CENTRO_ZIPCODES:
            return timezone('America/Guatemala') # UTC-6
        # Tiempo del centro en frontiera areas
        elif code in ('TAM', 'NLE', 'COA') and zipcode in TIEMPO_DEL_CENTRO_EN_FRONTIERA_ZIPCODES:
            return timezone('America/Matamoros') # UTC-6 (-5 DST)
        # Pacific area
        elif code in ('SON', 'BCS', 'SIN', 'NAY'):
            return timezone('America/Hermosillo') # UTC-7
        # By default, takes the central area timezone
        return timezone('America/Guatemala') # UTC-6

    @api.model
    def get_partner_localisation_fields_required_to_invoice(self, country_id):
        res = super().get_partner_localisation_fields_required_to_invoice(country_id)
        if country_id.code == 'MX':
            res.extend([self.env['ir.model.fields']._get(self._name, 'l10n_mx_edi_fiscal_regime')])
        return res
