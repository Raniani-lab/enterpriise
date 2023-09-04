# -*- coding: utf-8 -*-
from odoo import models, fields, _
from odoo.exceptions import ValidationError
from odoo.addons.l10n_mx_edi.models.account_move import USAGE_SELECTION


class PosOrder(models.Model):
    _inherit = 'pos.order'

    l10n_mx_edi_cfdi_to_public = fields.Boolean(
        string="CFDI to public",
        help="Send the CFDI with recipient 'publico en general'",
    )

    l10n_mx_edi_usage = fields.Selection(
        selection=USAGE_SELECTION,
        string="Usage",
        default='G01',
        help="The code that corresponds to the use that will be made of the receipt by the recipient.",
    )

    def _order_fields(self, ui_order):
        # OVERRIDE
        vals = super()._order_fields(ui_order)
        if vals['to_invoice'] and self.env['pos.session'].browse(vals['session_id']).company_id.country_id.code == 'MX':
            # the following fields might not be set for non mexican companies
            vals.update({
                'l10n_mx_edi_cfdi_to_public': ui_order.get('l10n_mx_edi_cfdi_to_public'),
                'l10n_mx_edi_usage': ui_order.get('l10n_mx_edi_usage'),
            })
        return vals

    def _prepare_invoice_vals(self):
        # OVERRIDE
        if self.company_id.country_id.code == 'MX' and len(self.refunded_order_ids.account_move) > 1:
            # raise before the super() call to avoid a traceback
            raise ValidationError(_("You cannot refund multiple invoices at once."))
        vals = super()._prepare_invoice_vals()
        if self.company_id.country_id.code == 'MX':
            vals.update({
                'l10n_mx_edi_cfdi_to_public': self.l10n_mx_edi_cfdi_to_public,
                'l10n_mx_edi_usage': self.l10n_mx_edi_usage,
                # In case of several pos.payment.method, pick the one with the highest amount
                'l10n_mx_edi_payment_method_id': self.payment_ids.sorted(
                    lambda p: -p.amount)[:1].payment_method_id.l10n_mx_edi_payment_method_id.id,
            })
            if self.refunded_order_ids.account_move:
                vals['l10n_mx_edi_cfdi_origin'] = '03|' + self.refunded_order_ids.account_move.l10n_mx_edi_cfdi_uuid
        return vals
