# coding: utf-8

from odoo import fields, models, api
from odoo.addons.l10n_mx_edi.models.account_move import USAGE_SELECTION


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    l10n_mx_edi_cfdi_to_public = fields.Boolean(
        string="CFDI to public",
        compute='_compute_l10n_mx_edi_cfdi_to_public',
        readonly=False,
        store=True,
        help="Send the CFDI with recipient 'publico en general'",
    )

    l10n_mx_edi_usage = fields.Selection(
        selection=USAGE_SELECTION,
        string="Usage",
        default='S01',
        help="The code that corresponds to the use that will be made of the receipt by the recipient.",
    )

    @api.depends('company_id')
    def _compute_l10n_mx_edi_cfdi_to_public(self):
        for order in self:
            order.l10n_mx_edi_cfdi_to_public = False

    def _prepare_invoice(self):
        # OVERRIDE
        vals = super()._prepare_invoice()
        vals['l10n_mx_edi_cfdi_to_public'] = self.l10n_mx_edi_cfdi_to_public
        vals['l10n_mx_edi_usage'] = self.l10n_mx_edi_usage
        return vals
