# -*- coding: utf-8 -*-

from odoo import api, models, fields


class AccountBankStatementLine(models.Model):
    _inherit = "account.bank.statement.line"

    l10n_mx_edi_payment_method_id = fields.Many2one(
        'l10n_mx_edi.payment.method',
        string='Payment Way',
        help='Indicates the way the payment was/will be received, where the '
        'options could be: Cash, Nominal Check, Credit Card, etc.')

    def reconcile(self, lines_vals_list, to_check=False):
        # OVERRIDE
        super().with_context(l10n_mx_edi_manual_reconciliation=False).reconcile(lines_vals_list, to_check=to_check)

    def l10n_mx_edi_is_required(self):
        self.ensure_one()
        # TODO remove this crappy hack and make a bridge module for l10n_mx_edi and point_of_sale
        if getattr(self, 'pos_statement_id', False):
            # payments from pos not must generate payment complement: pos is tolerated not supported
            return False
        country = self.env.ref('base.mx')
        return self.company_id.country_id == country

    @api.onchange('partner_id')
    def _l10n_mx_onchange_partner_bank_id(self):
        self.bank_account_id = False
        if len(self.partner_id.bank_ids) == 1:
            self.bank_account_id = self.partner_id.bank_ids

    # -------------------------------------------------------------------------
    # RECONCILIATION METHODS
    # -------------------------------------------------------------------------

    def _prepare_reconciliation(self, lines_vals_list, create_payment_for_invoice=False):
        # OVERRIDE
        create_payment_for_invoice |= self.company_id.country_id == self.env.ref('base.MX')
        return super()._prepare_reconciliation(lines_vals_list, create_payment_for_invoice=create_payment_for_invoice)
