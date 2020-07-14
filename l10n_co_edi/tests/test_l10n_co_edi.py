# coding: utf-8
import os
import re
from unittest.mock import patch, Mock

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo.tools import misc, mute_logger


@tagged('post_install', '-at_install')
class InvoiceTransactionCase(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_co.l10n_co_chart_template_generic'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.partner = cls.env.ref('base.res_partner_12')
        cls.partner.country_id = cls.env.ref('base.co')

        cls.company = cls.env.company
        cls.company.country_id = cls.env.ref('base.co')

        cls.salesperson = cls.env.ref('base.user_admin')
        cls.salesperson.function = 'Sales'

        report_text = 'GRANDES CONTRIBUYENTES SHD Res. DDI-042065 13-10-17'
        cls.company.l10n_co_edi_header_gran_contribuyente = report_text
        cls.company.l10n_co_edi_header_tipo_de_regimen = report_text
        cls.company.l10n_co_edi_header_retenedores_de_iva = report_text
        cls.company.l10n_co_edi_header_autorretenedores = report_text
        cls.company.l10n_co_edi_header_resolucion_aplicable = report_text
        cls.company.l10n_co_edi_header_actividad_economica = report_text
        cls.company.l10n_co_edi_header_bank_information = report_text

        cls.company.vat = '0123456789'
        cls.company.partner_id.l10n_co_document_type = 'rut'
        cls.company.partner_id.l10n_co_edi_representation_type_id = cls.env.ref('l10n_co_edi.representation_type_0')
        cls.company.partner_id.l10n_co_edi_establishment_type_id = cls.env.ref('l10n_co_edi.establishment_type_0')
        cls.company.partner_id.l10n_co_edi_obligation_type_ids = cls.env.ref('l10n_co_edi.obligation_type_0')
        cls.company.partner_id.l10n_co_edi_customs_type_ids = cls.env.ref('l10n_co_edi.customs_type_0')
        cls.company.partner_id.l10n_co_edi_large_taxpayer = True

        cls.partner.vat = '9876543210'
        cls.partner.l10n_co_document_type = 'rut'
        cls.partner.l10n_co_edi_representation_type_id = cls.env.ref('l10n_co_edi.representation_type_0')
        cls.partner.l10n_co_edi_establishment_type_id = cls.env.ref('l10n_co_edi.establishment_type_0')
        cls.partner.l10n_co_edi_obligation_type_ids = cls.env.ref('l10n_co_edi.obligation_type_0')
        cls.partner.l10n_co_edi_customs_type_ids = cls.env.ref('l10n_co_edi.customs_type_0')
        cls.partner.l10n_co_edi_large_taxpayer = True

        cls.tax = cls.company_data['default_tax_sale']
        cls.tax.amount = 15
        cls.tax.l10n_co_edi_type = cls.env.ref('l10n_co_edi.tax_type_0')
        cls.retention_tax = cls.tax.copy({
            'l10n_co_edi_type': cls.env.ref('l10n_co_edi.tax_type_9').id
        })

        cls.env.ref('uom.product_uom_unit').l10n_co_edi_ubl = 'S7'

    def test_dont_handle_non_colombian(self):
        self.company.country_id = self.env.ref('base.us')
        product = self.env.ref('product.product_product_4')
        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner.id,
            'invoice_line_ids': [
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 1,
                    'price_unit': 42,
                    'name': 'something',
                })
            ]
        })

        invoice.post()
        self.assertEqual(invoice.l10n_co_edi_invoice_status, 'not_sent',
                         'Invoices belonging to a non-Colombian company should not be sent.')

    def _validate_and_compare(self, invoice, invoice_number, filename_expected):

        return_value = {
            'message': 'mocked success',
            'transactionId': 'mocked_success',
        }
        with patch('odoo.addons.l10n_co_edi.models.carvajal_request.CarvajalRequest.upload', new=Mock(return_value=return_value)):
            invoice.post()

        invoice.number = invoice_number
        generated_xml = invoice._l10n_co_edi_generate_xml().decode()

        # the ENC_{7,8,16} tags contain information related to the "current" date
        for date_tag in ('ENC_7', 'ENC_8', 'ENC_16'):
            generated_xml = re.sub('<%s>.*</%s>' % (date_tag, date_tag), '', generated_xml)

        # show the full diff
        self.maxDiff = None
        with misc.file_open(os.path.join('l10n_co_edi', 'tests', filename_expected)) as f:
            self.assertEqual(f.read().strip(), generated_xml.strip())

    def test_invoice(self):
        '''Tests if we generate an accepted XML for an invoice and a credit note.'''
        product = self.env.ref('product.product_product_4')
        invoice = self.env['account.move'].create({
            'partner_id': self.partner.id,
            'move_type': 'out_invoice',
            'invoice_user_id': self.salesperson.id,
            'name': 'OC 123',
            'invoice_line_ids': [
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 150,
                    'price_unit': 250,
                    'discount': 10,
                    'name': 'Line 1',
                    'tax_ids': [(6, 0, (self.tax.id, self.retention_tax.id))],
                }),
                (0, 0, {
                    'quantity': 1,
                    'price_unit': 0.2,
                    'name': 'Line 2',
                    'tax_ids': [(6, 0, (self.tax.id, self.retention_tax.id))],
                    'product_uom_id': self.env.ref('uom.product_uom_unit').id,
                })
            ]
        })

        self._validate_and_compare(invoice, 'TEST/00001', 'accepted_invoice.xml')

        # To stop a warning about "Tax Base Amount not computable
        # probably due to a change in an underlying tax " which seems
        # to be expected when generating refunds.
        with mute_logger('odoo.addons.account.models.account_invoice'):
            credit_note = invoice.refund()

        self._validate_and_compare(credit_note, 'TEST/00002', 'accepted_credit_note.xml')
