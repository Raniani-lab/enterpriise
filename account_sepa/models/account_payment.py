# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError


class AccountPayment(models.Model):
    _inherit = "account.payment"

    @api.model
    def _get_method_codes_using_bank_account(self):
        res = super(AccountPayment, self)._get_method_codes_using_bank_account()
        res += ['sepa_ct']
        return res

    @api.model
    def _get_method_codes_needing_bank_account(self):
        res = super(AccountPayment, self)._get_method_codes_needing_bank_account()
        res += ['sepa_ct']
        return res

    @api.depends('payment_method_id', 'invoice_ids.partner_id.commercial_partner_id')
    def _compute_possible_bank_partners(self):
        super()._compute_possible_bank_partners()
        sepa_ct = self.env.ref('account_sepa.account_payment_method_sepa_ct')
        for p in self.filtered(lambda r: r.payment_method_id == sepa_ct):
            partners = p.invoice_ids.partner_id
            p.possible_bank_partner_ids = partners | partners.commercial_partner_id

    @api.constrains('payment_method_id', 'journal_id')
    def _check_bank_account(self):
        for rec in self:
            if rec.payment_method_id == self.env.ref('account_sepa.account_payment_method_sepa_ct'):
                if not rec.journal_id.bank_account_id or not rec.journal_id.bank_account_id.acc_type == 'iban':
                    raise ValidationError(_("The journal '%s' requires a proper IBAN account to pay via SEPA. Please configure it first.") % rec.journal_id.name)

class AccountPaymentRegister(models.TransientModel):
    _inherit = "account.payment.register"

    def get_payments_vals(self):
        if self.payment_method_id.code == 'sepa_ct' and self.invoice_ids.filtered(lambda inv: not inv.invoice_partner_bank_id):
            raise UserError(
                '{} {}'.format(
                    _('A bank account must be set on the following documents: '),
                    ', '.join(self.invoice_ids.filtered(lambda inv: not inv.invoice_partner_bank_id).mapped('name'))
                )
            )
        return super().get_payments_vals()
