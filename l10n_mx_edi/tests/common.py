# coding: utf-8

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo.tools import misc

import base64
import os


@tagged('post_install', '-at_install')
class InvoiceTransactionCase(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_mx.mx_coa'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.certificate = cls.env['l10n_mx_edi.certificate'].create({
            'content': base64.encodebytes(misc.file_open(os.path.join('l10n_mx_edi', 'demo', 'pac_credentials', 'certificate.cer'), 'rb').read()),
            'key': base64.encodebytes(misc.file_open(os.path.join('l10n_mx_edi', 'demo', 'pac_credentials', 'certificate.key'), 'rb').read()),
            'password': '12345678a',
        })

        cls.company_data['company'].write({
            'country_id': cls.env.ref('base.mx').id,
            'vat': 'EKU9003173C9',
            'zip': '37200',
            'l10n_mx_edi_pac': 'finkok',
            'l10n_mx_edi_pac_test_env': True,
            'l10n_mx_edi_certificate_ids': [(6, 0, cls.certificate.ids)],
        })

        cls.tax_model = cls.env['account.tax']
        cls.partner_agrolait = cls.env.ref("base.res_partner_address_4")
        cls.partner_agrolait.type = 'invoice'
        cls.partner_agrolait.parent_id.street_name = 'Street Parent'
        cls.product = cls.env.ref("product.product_product_3")
        cls.company = cls.env.company
        cls.account_settings = cls.env['res.config.settings']
        cls.tax_positive = cls.tax_model.create({
            'name': 'IVA(16%) VENTAS TEST',
            'description': 'IVA(16%)',
            'amount': 16,
            'amount_type': 'percent',
            'type_tax_use': 'sale',
        })
        cls.tax_positive.l10n_mx_cfdi_tax_type = 'Tasa'
        cls.tax_negative = cls.tax_model.create({
            'name': 'ISR',
            'amount_type': 'percent',
            'amount': -10,
            'l10n_mx_cfdi_tax_type': 'Tasa',
        })
        cls.product.taxes_id = [cls.tax_positive.id, cls.tax_negative.id]
        cls.product.unspsc_code_id = cls.env.ref('product_unspsc.unspsc_code_01010101').id
        cls.payment_term = cls.env.ref('account.account_payment_term_30days')
        # force PPD
        cls.payment_term.line_ids.days = 90
        cls.company.l10n_mx_edi_fiscal_regime = '601'
        cls.payment_method_cash = cls.env.ref(
            'l10n_mx_edi.payment_method_efectivo')
        cls.account_payment = cls.env['res.partner.bank'].create({
            'acc_number': 'TEST123456789',
            'partner_id': cls.partner_agrolait.id,
        })
        cls.rate_model = cls.env['res.currency.rate']
        cls.mxn = cls.env.ref('base.MXN')
        cls.usd = cls.env.ref('base.USD')
        cls.ova = cls.env['account.account'].search([
            ('user_type_id', '=', cls.env.ref(
                'account.data_account_type_current_assets').id)], limit=1)

    def set_currency_rates(self, mxn_rate, usd_rate):
        date = (self.env['l10n_mx_edi.certificate'].sudo().
                get_mx_current_datetime().date())
        self.mxn.rate_ids.filtered(
            lambda r: r.name == date).unlink()
        self.mxn.rate_ids = self.rate_model.create({
            'rate': mxn_rate, 'name': date})
        self.usd.rate_ids.filtered(
            lambda r: r.name == date).unlink()
        self.usd.rate_ids = self.rate_model.create({
            'rate': usd_rate, 'name': date})

    def create_invoice(self, inv_type='out_invoice', currency_id=None):
        if currency_id is None:
            currency_id = self.usd.id
        self.partner_agrolait.lang = None
        invoice = self.env['account.move'].create({
            'partner_id': self.partner_agrolait.id,
            'move_type': inv_type,
            'currency_id': currency_id,
            'l10n_mx_edi_payment_method_id': self.payment_method_cash.id,
            'l10n_mx_edi_partner_bank_id': self.account_payment.id,
            'invoice_line_ids': [(0, 0, {
                'product_id': self.product.id,
                'quantity': 1,
                'price_unit': 450.0,
                'product_uom_id': self.product.uom_id.id,
                'name': self.product.name,
            })],
        })
        return invoice
