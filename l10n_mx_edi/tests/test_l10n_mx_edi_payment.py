# -*- coding: utf-8 -*-

from datetime import timedelta
from odoo.tests.common import Form
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT
from odoo.tests import tagged
from . import common
import unittest


@tagged('post_install', '-at_install', '-standard', 'external')
class TestL10nMxEdiPayment(common.InvoiceTransactionCase):
    def setUp(self):
        super(TestL10nMxEdiPayment, self).setUp()
        self.tax_positive.l10n_mx_cfdi_tax_type = 'Tasa'
        self.tax_negative.l10n_mx_cfdi_tax_type = 'Tasa'
        isr_tag = self.env['account.account.tag'].search(
            [('name', '=', 'ISR')])
        for rep_line in self.tax_negative.invoice_repartition_line_ids:
            rep_line.tag_ids |= isr_tag
        self.product.unspsc_code_id = self.ref(
            'product_unspsc.unspsc_code_01010101')
        self.payment_method_manual_out = self.env.ref(
            "account.account_payment_method_manual_out")
        self.bank = self.env.ref('base.bank_ing')
        self.bank.l10n_mx_edi_vat = 'BBA830831LJ2'
        self.company_bank = self.env['res.partner.bank'].create({
            'acc_number': '1234567890',
            'bank_id': self.bank.id,
            'partner_id': self.company.partner_id.id,
        })
        self.account_payment.bank_id = self.bank.id
        self.account_payment.acc_number = '0123456789'
        self.transfer = self.browse_ref('l10n_mx_edi.payment_method_transferencia')
        self.set_currency_rates(mxn_rate=12.21, usd_rate=1)

    @unittest.skip("No longer working since 13.0")
    def test_payment_multicurrency_writeoff(self):
        """Create a payment in USD to invoice in MXN with writeoff"""
        self.set_currency_rates(mxn_rate=1, usd_rate=0.055556)
        date_mx = self.env[
            'l10n_mx_edi.certificate'].sudo().get_mx_current_datetime()
        date = (date_mx - timedelta(days=1)).strftime(
            DEFAULT_SERVER_DATE_FORMAT)
        self.usd.rate_ids = self.rate_model.create({
            'rate': 0.05, 'name': date})
        invoice = self.create_invoice()
        invoice.invoice_date = date
        invoice.action_post()
        ctx = {'active_model': 'account.move', 'active_ids': [invoice.id]}
        register_payments = self.env['account.payment.register'].with_context(ctx).create({
            'payment_date': date_mx,
            'l10n_mx_edi_payment_method_id': self.env.ref('l10n_mx_edi.payment_method_efectivo').id,
            'payment_method_id': self.env.ref("account.account_payment_method_manual_in").id,
        })
        payment = register_payments._create_payments()
        self.assertEqual(payment.l10n_mx_edi_pac_status, "signed",
                         payment.message_ids.mapped('body'))
        cfdi = payment.l10n_mx_edi_get_xml_etree()
        self.asertEquals(
            payment.l10n_mx_edi_get_payment_etree(cfdi)[0].get('ImpSaldoInsoluto'), '0.00',
            'The invoice was not marked as fully paid in the payment complement.')

    def test_payment_refund(self):
        invoice = self.create_invoice()
        invoice.invoice_payment_term_id = self.payment_term
        invoice.name = 'INV/2017/999'
        invoice.action_post()
        invoice.refresh()
        self.assertEqual(invoice.l10n_mx_edi_pac_status, "signed",
                         invoice.message_ids.mapped("body"))
        ctx = {'active_ids': invoice.ids, 'active_model': 'account.move'}
        refund = self.env['account.move.reversal'].with_context(ctx).create({
            'refund_method': 'refund',
            'reason': 'Refund Test',
            'date': invoice.invoice_date,
        })
        result = refund.reverse_moves()
        refund_id = result.get('res_id')
        invoice_refund = self.env['account.move'].browse(refund_id)
        move_form = Form(invoice_refund)
        with move_form.invoice_line_ids.edit(0) as line_form:
            line_form.price_unit = invoice.invoice_line_ids[0].price_unit / 2
        move_form.save()
        invoice_refund.refresh()
        invoice_refund.action_post()
        lines = invoice.mapped('line_ids').filtered(
            lambda l: l.account_id.user_type_id.type == 'receivable')
        invoice_refund.js_assign_outstanding_line(lines.ids)

        payment = self.env['account.payment.register']\
            .with_context(active_model='account.move', active_ids=invoice.ids)\
            .create({
                'payment_date': invoice.invoice_date,
                'l10n_mx_edi_payment_method_id': self.env.ref('l10n_mx_edi.payment_method_efectivo').id,
            })\
            ._create_payments()
        payment.action_post()
        self.assertEqual(payment.l10n_mx_edi_pac_status, "signed",
                         payment.message_ids.mapped('body'))
