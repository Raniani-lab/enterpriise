# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class AccountPaymentRegister(models.TransientModel):
    _inherit = 'account.payment.register'

    l10n_mx_edi_payment_method_id = fields.Many2one(
        comodel_name='l10n_mx_edi.payment.method',
        string='Payment Way',
        help="Indicates the way the payment was/will be received, where the options could be: "
             "Cash, Nominal Check, Credit Card, etc.")
    l10n_mx_edi_partner_bank_id = fields.Many2one(
        comodel_name='res.partner.bank',
        string='Partner Bank',
        help="If the payment was made with a financial institution define the bank account used "
             "in this payment.")

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    @api.model
    def _get_line_batch_key(self, line):
        # OVERRIDE
        # Group moves also using these additional fields.
        res = super()._get_line_batch_key(line)
        res.update({
            'l10n_mx_edi_payment_method_id': line.move_id.l10n_mx_edi_payment_method_id.id,
            'l10n_mx_edi_partner_bank_id': line.move_id.l10n_mx_edi_partner_bank_id.id,
        })
        return res

    @api.model
    def _get_wizard_values_from_batch(self, batch_result):
        res = super()._get_wizard_values_from_batch(batch_result)

        key_values = batch_result['key_values']
        return {
            **res,
            'l10n_mx_edi_payment_method_id': key_values['l10n_mx_edi_payment_method_id'],
            'l10n_mx_edi_partner_bank_id': key_values['l10n_mx_edi_partner_bank_id'],
        }

    # -------------------------------------------------------------------------
    # BUSINESS METHODS
    # -------------------------------------------------------------------------

    def _create_payment_vals_from_wizard(self):
        # OVERRIDE
        payment_vals = super()._create_payment_vals_from_wizard()
        payment_vals.update({
            'l10n_mx_edi_payment_method_id': self.l10n_mx_edi_payment_method_id.id,
            'l10n_mx_edi_partner_bank_id': self.l10n_mx_edi_partner_bank_id.id,
        })
        return payment_vals

    def _create_payment_vals_from_batch(self, batch_result):
        # OVERRIDE
        payment_vals = super()._create_payment_vals_from_batch(batch_result)
        payment_vals.update({
            'l10n_mx_edi_payment_method_id': batch_result['key_values']['l10n_mx_edi_payment_method_id'],
            'l10n_mx_edi_partner_bank_id': batch_result['key_values']['l10n_mx_edi_partner_bank_id'],
        })
        return payment_vals
