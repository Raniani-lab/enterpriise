# -*- coding: utf-8 -*-

from . import common


class TestL10nMxEdiPayment(common.InvoiceTransactionCase):
    def setUp(self):
        super(TestL10nMxEdiPayment, self).setUp()
        isr_tag = self.env['account.account.tag'].search(
            [('name', '=', 'ISR')])
        self.tax_negative.tag_ids |= isr_tag
        self.company.partner_id.write({
            'property_account_position_id': self.fiscal_position.id,
        })

    def test_invoice_multicurrency(self):
        """Create the next case, to check that payment complement is correct
            Invoice 1 - USD
            Invoice 2 - MXN
            Payment --- USD"""
        self.set_currency_rates(mxn_rate=1, usd_rate=0.05)
        invoices = self.create_invoice()
        invoices |= self.create_invoice(currency_id=self.mxn.id)
        invoices.action_invoice_open()
        bank_journal = self.env['account.journal'].search([
            ('type', '=', 'bank')], limit=1)
        bank_journal.currency_id = self.usd
        bank_statement = self.env['account.bank.statement'].create({
            'journal_id': self.bank_journal.id,
            'line_ids': [(0, 0, {
                'name': 'Payment',
                'partner_id': invoices[0].partner_id.id,
                'amount': invoices[0].amount_total + self.mxn.compute(
                    invoices[1].amount_total, self.usd),
                'currency_id': self.usd.id,
                'l10n_mx_edi_payment_method_id': self.payment_method_cash.id,
            })],
        })
        values = []
        lines = invoices.mapped('move_id.line_ids').filtered(
            lambda l: l.account_id.user_type_id.type == 'receivable')
        for line in lines:
            values.append({
                'credit': line.debit,
                'debit': 0,
                'name': line.name,
                'move_line': line,
            })
        bank_statement.line_ids.process_reconciliation(values)
        self.assertEquals(
            invoices.mapped('payment_ids').l10n_mx_edi_pac_status, 'signed',
            'The payment was not signed')
