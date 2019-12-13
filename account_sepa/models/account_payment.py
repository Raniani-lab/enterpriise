# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError


class AccountPayment(models.Model):
    _inherit = "account.payment"

    display_qr_code = fields.Boolean(compute="_compute_display_code", store=False)
    qr_code_url = fields.Char(compute="_compute_qr_code_url", store=False)

    @api.depends('partner_type', 'payment_method_code', 'partner_bank_account_id')
    def _compute_display_code(self):
        for record in self:
            record.display_qr_code = (record.partner_type == 'supplier' and
                                      record.payment_method_code == 'manual' and
                                      bool(record.partner_bank_account_id) and
                                      record.partner_bank_account_id.qr_code_valid)

    @api.depends('partner_bank_account_id', 'amount', 'communication')
    def _compute_qr_code_url(self):
        for record in self:
            if record.partner_bank_account_id.qr_code_valid:
                txt = _('Scan me with your banking app.')
                record.qr_code_url = '''
                    <br/>
                    <img class="border border-dark rounded" src="{qrcode}"/>
                    <br/>
                    <strong class="text-center">{txt}</strong>
                    '''.format(
                        txt=txt,
                        qrcode=record.partner_bank_account_id.build_qr_code_url(record.amount, record.communication))
            else:
                record.qr_code_url = '<strong class="text-center">{error}</strong><br/>'.format(
                    error=_('The SEPA QR Code information is not set correctly.'))

    @api.model
    def _get_method_codes_using_bank_account(self):
        res = super(AccountPayment, self)._get_method_codes_using_bank_account()
        res += ['sepa_ct', 'manual']
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

    @api.onchange('destination_journal_id')
    def _onchange_destination_journal_id(self):
        if hasattr(super(AccountPayment, self), '_onchange_destination_journal_id'):
            super(AccountPayment, self)._onchange_destination_journal_id()
        if self.destination_journal_id:
            bank_account = self.destination_journal_id.bank_account_id
            self.partner_id = bank_account.company_id.partner_id
            self.partner_bank_account_id = bank_account


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
