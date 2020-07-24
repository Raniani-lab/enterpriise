# coding: utf-8
from odoo.tests import tagged

import base64
from datetime import timedelta
import os
import time
import unittest

from odoo.exceptions import ValidationError
from odoo.tools import misc
from odoo.tests.common import Form

from . import common


@tagged('post_install', '-at_install', '-standard', 'external')
class TestL10nMxEdiInvoice(common.InvoiceTransactionCase):
    def setUp(self):
        super(TestL10nMxEdiInvoice, self).setUp()
        self.cert = misc.file_open(os.path.join(
            'l10n_mx_edi', 'demo', 'pac_credentials', 'certificate.cer'), 'rb').read()
        self.cert_key = misc.file_open(os.path.join(
            'l10n_mx_edi', 'demo', 'pac_credentials', 'certificate.key'), 'rb').read()
        self.cert_password = '12345678a'
        self.set_currency_rates(mxn_rate=21, usd_rate=1)
        self.config_parameter = self.env.ref(
            'l10n_mx_edi.l10n_mx_edi_version_cfdi')
        isr_tag = self.env['account.account.tag'].search(
            [('name', '=', 'ISR')])
        for rep_line in self.tax_negative.invoice_repartition_line_ids:
            rep_line.tag_ids |= isr_tag
        self.payment_method_manual_out = self.env.ref(
            "account.account_payment_method_manual_out")

    def test_l10n_mx_edi_invoice_basic(self):
        # -----------------------
        # Testing sign process
        # -----------------------
        invoice = self.create_invoice()
        invoice.sudo().journal_id.l10n_mx_address_issued_id = self.env.company.partner_id.id
        invoice.name = 'INV/2017/999'
        invoice.post()
        self.assertEqual(invoice.state, "posted")
        self.assertEqual(invoice.l10n_mx_edi_pac_status, "signed",
                         invoice.message_ids.mapped('body'))

        # -------------------------------------------------------
        # Testing deletion of attachments (XML & PDF) once signed
        # -------------------------------------------------------
        xml_attachment = self.env['ir.attachment'].search([
            ('res_id', '=', invoice.id),
            ('res_model', '=', 'account.move'),
            ('name', '=', invoice.l10n_mx_edi_cfdi_name)])
        error_msg = 'You cannot delete a set of documents which has a legal'
        with self.assertRaisesRegex(ValidationError, error_msg):
            xml_attachment.unlink()
        # Creates a dummy PDF to attach it and then try to delete it
        pdf_filename = '%s.pdf' % os.path.splitext(xml_attachment.name)[0]
        pdf_attachment = self.env['ir.attachment'].with_context({}).create({
            'name': pdf_filename,
            'res_id': invoice.id,
            'res_model': 'account.move',
            'datas': base64.encodebytes(b'%PDF-1.3'),
        })
        pdf_attachment.unlink()

        # ----------------
        # Testing discount
        # ----------------
        invoice_disc = invoice.copy()
        with Form(invoice_disc) as move_form:
            for i in range(len(invoice_disc.invoice_line_ids)):
                with move_form.invoice_line_ids.edit(i) as line_form:
                    line_form.discount = 10
                    line_form.price_unit = 500
        invoice_disc.post()
        self.assertEqual(invoice_disc.state, "posted")
        self.assertEqual(invoice_disc.l10n_mx_edi_pac_status, "signed",
                         invoice.message_ids.mapped('body'))

        # -----------------------
        # Testing re-sign process (recovery a previous signed xml)
        # -----------------------
        invoice.l10n_mx_edi_pac_status = "retry"
        self.assertEqual(invoice.l10n_mx_edi_pac_status, "retry")
        invoice.l10n_mx_edi_update_pac_status()
        for _x in range(10):
            if invoice.l10n_mx_edi_pac_status == 'signed':
                break
            time.sleep(2)
            invoice.l10n_mx_edi_retrieve_last_attachment().unlink()
            invoice.l10n_mx_edi_update_pac_status()
        self.assertEqual(invoice.l10n_mx_edi_pac_status, "signed",
                         invoice.message_ids.mapped('body'))
        xml_attachs = invoice.l10n_mx_edi_retrieve_attachments()
        self.assertEqual(len(xml_attachs), 2)

        # -----------------------
        # Testing cancel PAC process
        # -----------------------
        invoice.with_context(called_from_cron=True).button_cancel()
        self.assertEqual(invoice.state, "cancel")
        self.assertTrue(
            invoice.l10n_mx_edi_pac_status in ['cancelled', 'to_cancel'],
            invoice.message_ids.mapped('body'))
        invoice.l10n_mx_edi_pac_status = "signed"

        # -----------------------
        # Testing cancel SAT process
        # -----------------------
        invoice.l10n_mx_edi_update_sat_status()
        self.assertNotEqual(invoice.l10n_mx_edi_sat_status, "cancelled")

    def test_multi_currency(self):
        invoice = self.create_invoice()
        usd_rate = 20.0

        # -----------------------
        # Testing company.mxn.rate=1 and invoice.usd.rate=1/value
        # -----------------------
        self.set_currency_rates(mxn_rate=1, usd_rate=1/usd_rate)
        values = invoice._l10n_mx_edi_create_cfdi_values()
        self.assertEqual(float(values['rate']), usd_rate)

        # -----------------------
        # Testing company.mxn.rate=value and invoice.usd.rate=1
        # -----------------------
        self.set_currency_rates(mxn_rate=usd_rate, usd_rate=1)
        values = invoice._l10n_mx_edi_create_cfdi_values()
        self.assertEqual(float(values['rate']), usd_rate)

        # -----------------------
        # Testing using MXN currency for invoice and company
        # -----------------------
        invoice.currency_id = self.mxn.id
        values = invoice._l10n_mx_edi_create_cfdi_values()
        self.assertFalse(values['rate'])

    @unittest.skip("No longer working since 13.0")
    def test_l10n_mx_edi_invoice_basic_33(self):
        self.test_l10n_mx_edi_invoice_basic()

        # -----------------------
        # Testing invoice refund to verify CFDI related section
        # -----------------------
        invoice = self.create_invoice()
        invoice.post()
        refund = self.env['account.move.reversal'].with_context(active_model='account.move', active_ids=invoice.ids).create({
            'refund_method': 'refund',
            'reason': 'Refund Test',
            'date': invoice.invoice_date,
        })
        result = refund.reverse_moves()
        refund_id = result['res_id']
        refund = self.env['account.move'].browse(refund_id)
        refund.post()
        xml = refund.l10n_mx_edi_get_xml_etree()
        self.assertEqual(xml.CfdiRelacionados.CfdiRelacionado.get('UUID'),
                          invoice.l10n_mx_edi_cfdi_uuid,
                          'Invoice UUID is different to CFDI related')

        # -----------------------
        # Testing invoice without product to verify no traceback
        # -----------------------
        invoice = self.create_invoice()
        invoice.invoice_line_ids[0].product_id = False
        invoice.compute_taxes()
        invoice.post()
        self.assertEqual(invoice.state, "posted")

        # -----------------------
        # Testing case with include base amount
        # -----------------------
        invoice = self.create_invoice()
        tax_ieps = self.tax_positive.copy({
            'name': 'IEPS 9%',
            'amount': 9.0,
            'include_base_amount': True,
        })
        self.tax_positive.sequence = 3
        for line in invoice.invoice_line_ids:
            line.invoice_line_tax_id = [self.tax_positive.id, tax_ieps.id]
        invoice.compute_taxes()
        invoice.post()
        self.assertEqual(invoice.l10n_mx_edi_pac_status, "signed",
                         invoice.message_ids.mapped('body'))
        xml_total = invoice.l10n_mx_edi_get_xml_etree().get('Total')
        self.assertEqual(invoice.amount_total, float(xml_total),
                         'The amount with include base amount is incorrect')

        # -----------------------
        # Testing send payment by email
        # -----------------------
        invoice = self.create_invoice()
        invoice.post()
        bank_journal = self.env['account.journal'].search([
            ('type', '=', 'bank')], limit=1)
        payment_register = Form(self.env['account.payment'].with_context(active_model='account.move', active_ids=invoice.ids))
        payment_register.date = invoice.date
        payment_register.l10n_mx_edi_payment_method_id = self.env.ref(
                'l10n_mx_edi.payment_method_efectivo')
        payment_register.payment_method_id = self.env.ref(
                "account.account_payment_method_manual_in")
        payment_register.journal_id = bank_journal
        payment_register.ref = invoice.name
        payment_register.amount = invoice.amount_total
        payment = payment_register.save()
        payment.post()
        self.assertEqual(payment.l10n_mx_edi_pac_status, "signed",
                         payment.message_ids.mapped('body'))
        default_template = self.env.ref(
            'account.mail_template_data_payment_receipt')
        wizard_mail = self.env['mail.compose.message'].with_context({
            'default_template_id': default_template.id,
            'default_model': 'account.payment',
            'default_res_id': payment.id}).create({})
        res = wizard_mail.onchange_template_id(
            default_template.id, wizard_mail.composition_mode,
            'account_payment', payment.id)
        wizard_mail.write({'attachment_ids': res.get('value', {}).get(
            'attachment_ids', [])})
        wizard_mail.send_mail()
        attachment = payment.l10n_mx_edi_retrieve_attachments()
        self.assertEqual(len(attachment), 2,
                         'Documents not attached correctly')

    @unittest.skip("No longer working since 13.0")
    def test_l10n_mx_edi_payment(self):
        self.company.l10n_mx_edi_fiscal_regime = '601'
        invoice = self.create_invoice()
        invoice.name = 'INV/2017/999'
        today = self.env['l10n_mx_edi.certificate'].sudo().get_mx_current_datetime()
        invoice.post()
        self.assertEqual(invoice.l10n_mx_edi_pac_status, "signed",
                         invoice.message_ids.mapped("body"))

        payment = self.env['account.payment.register']\
            .with_context(active_model='account.move', active_ids=invoice.ids)\
            .create({
                'payment_date': today.date() - timedelta(days=5),
            })\
            ._create_payments()

        self.assertEqual(
            payment.l10n_mx_edi_pac_status, 'signed',
            payment.message_ids.mapped('body'))
