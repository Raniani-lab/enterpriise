# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _

from odoo.exceptions import UserError

class AccountMove(models.Model):
    _inherit = 'account.move'

    sdd_paying_mandate_id = fields.Many2one(comodel_name='sdd.mandate', help="Once this invoice has been paid with Direct Debit, contains the mandate that allowed the payment.", copy=False)
    sdd_has_usable_mandate = fields.Boolean(compute='_compute_sdd_has_usable_mandate', search='_search_sdd_has_usable_mandate')

    def _sdd_pay_with_mandate(self, mandate):
        """ Uses the mandate passed in parameters to pay this invoice. This function
        updates the state of the mandate accordingly if it was of type 'one-off',
        changes the state of the invoice and generates the corresponding payment
        object, setting its state to 'posted'.
        """
        if self.is_outbound():
            raise UserError(_("You cannot do direct debit on a customer to pay a refund to him, or on a supplier to pay an invoice from him."))

        date_upper_bound = mandate.end_date or self.invoice_date
        if not(mandate.start_date <= self.invoice_date <= date_upper_bound):
            raise UserError(_("You cannot pay an invoice with a mandate that does not cover the moment when it was issued."))

        payment_method = self.env.ref('account_sepa_direct_debit.payment_method_sdd')
        payment_journal = mandate.payment_journal_id
        PaymentObj = self.env['account.payment'].with_context(active_id=self.id, active_ids=self.ids)

        #This code is only executed if the mandate may be used (thanks to the previous UserError)
        payment = PaymentObj.create({
            'invoice_ids': [(4, self.id, None)],
            'journal_id': payment_journal.id,
            'payment_method_id': payment_method.id,
            'amount': self.amount_residual,
            'currency_id': self.currency_id.id,
            'payment_type': 'inbound',
            'communication': self.ref or self.name,
            'partner_type': 'customer' if self.move_type == 'out_invoice' else 'supplier',
            'partner_id': mandate.partner_id.commercial_partner_id.id,
            'payment_date': self.invoice_date_due or self.invoice_date
        })

        payment.post()
        return payment

    @api.model
    def _search_sdd_has_usable_mandate(self, operator, value):
        """ Returns invoice ids for which a mandate exist that can be used to be paid,
            as domain : [('id', 'in', '[4,24,89]')]
            SQL is used to minimise footprint and is the same as :
            res = self.search([]).filtered(lambda rec: rec.sdd_has_usable_mandate is True and not rec.is_outbound())
            return [('id', domain_operator, [x['id'] for x in res])]
        """

        if (operator == '=' and value) or (operator == '!=' and not value):
            domain_operator = 'in'
        else:
            domain_operator = 'not in'

        query = '''
        SELECT
            move.id
        FROM
            sdd_mandate mandate
        LEFT JOIN
            account_move move ON move.company_id = mandate.company_id AND
            move.commercial_partner_id = mandate.partner_id
        WHERE
            move.move_type IN ('out_invoice', 'in_refund') AND
            mandate.state NOT IN ('draft', 'revoked') AND
            mandate.start_date <= move.invoice_date AND
            (mandate.end_date IS NULL OR mandate.end_date > move.invoice_date)
        '''

        self._cr.execute(query)

        return [('id', domain_operator, [x['id'] for x in self._cr.dictfetchall()])]

    @api.depends('company_id', 'commercial_partner_id', 'invoice_date')
    def _compute_sdd_has_usable_mandate(self):
        for rec in self:
            rec.sdd_has_usable_mandate = bool(rec._sdd_get_usable_mandate())

    def _sdd_get_usable_mandate(self):
        """ returns the first mandate found that can be used to pay this invoice,
        or none if there is no such mandate.
        """
        if self.move_type in ('out_invoice', 'in_refund'):
            return self.env['sdd.mandate']._sdd_get_usable_mandate(self.company_id.id, self.commercial_partner_id.id, self.invoice_date)
        else:
            return None

    def _track_subtype(self, init_values):
        # OVERRIDE to log a different message when an invoice is paid using SDD.
        self.ensure_one()
        if 'state' in init_values and self.state in ('in_payment', 'paid') and self.move_type == 'out_invoice' and self.sdd_paying_mandate_id:
            return self.env.ref('account_sepa_direct_debit.sdd_mt_invoice_paid_with_mandate')
        return super(AccountMove, self)._track_subtype(init_values)
