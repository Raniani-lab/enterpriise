# -*- coding: utf-8 -*-
from odoo import models, fields


class PosOrder(models.Model):
    _inherit = 'pos.order'

    l10n_mx_edi_cfdi_to_public = fields.Boolean(
        string="CFDI to public",
        help="Send the CFDI with recipient 'publico en general'",
    )

    l10n_mx_edi_usage = fields.Selection(
        selection=[
            ('G01', 'Acquisition of merchandise'),
            ('G02', 'Returns, discounts or bonuses'),
            ('G03', 'General expenses'),
            ('I01', 'Constructions'),
            ('I02', 'Office furniture and equipment investment'),
            ('I03', 'Transportation equipment'),
            ('I04', 'Computer equipment and accessories'),
            ('I05', 'Dices, dies, molds, matrices and tooling'),
            ('I06', 'Telephone communications'),
            ('I07', 'Satellite communications'),
            ('I08', 'Other machinery and equipment'),
            ('D01', 'Medical, dental and hospital expenses.'),
            ('D02', 'Medical expenses for disability'),
            ('D03', 'Funeral expenses'),
            ('D04', 'Donations'),
            ('D05', 'Real interest effectively paid for mortgage loans (room house)'),
            ('D06', 'Voluntary contributions to SAR'),
            ('D07', 'Medical insurance premiums'),
            ('D08', 'Mandatory School Transportation Expenses'),
            ('D09', 'Depositsamically display the fiscal_regime when the country selec in savings accounts, premiums based on pension plans.'),
            ('D10', 'Payments for educational services (Colegiatura)'),
            ('S01', "Without fiscal effects"),
        ],
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
        vals = super()._prepare_invoice_vals()
        if self.company_id.country_id.code == 'MX':
            vals.update({
                'l10n_mx_edi_cfdi_to_public': self.l10n_mx_edi_cfdi_to_public,
                'l10n_mx_edi_usage': self.l10n_mx_edi_usage,
                # In case of several pos.payment.method, pick the one with the highest amount
                'l10n_mx_edi_payment_method_id': self.payment_ids.sorted(
                    lambda p: -p.amount)[:1].payment_method_id.l10n_mx_edi_payment_method_id.id,
            })
        return vals
