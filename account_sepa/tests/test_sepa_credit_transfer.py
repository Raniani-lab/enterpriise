# -*- coding: utf-8 -*-

import base64
from lxml import etree

from odoo.addons.account.tests.common import AccountTestCommon
from odoo.modules.module import get_module_resource
from odoo.tests import tagged
from odoo.tests.common import Form


@tagged('post_install', '-at_install')
class TestSEPACreditTransfer(AccountTestCommon):

    @classmethod
    def setUpClass(cls):
        super(TestSEPACreditTransfer, cls).setUpClass()

        cls.env.user.company_id.country_id = cls.env.ref('base.be')

        # Get some records
        cls.asustek_sup = cls.env['res.partner'].create({'name': 'Wood Corner'})
        cls.supplier = cls.env['res.partner'].create({'name': 'Lambda Supplier'})
        cls.sepa_ct = cls.env.ref('account_sepa.account_payment_method_sepa_ct')

        # Create an IBAN bank account and its journal
        bank = cls.env['res.bank'].create({'name': 'ING', 'bic': 'BBRUBEBB'})
        cls.bank_journal = cls.env['account.journal'].create({
            'name': 'BE48363523682327',
            'type': 'bank',
            'bank_acc_number': 'BE48363523682327',
            'bank_id': bank.id,
        })
        if cls.bank_journal.company_id.currency_id != cls.env.ref("base.EUR"):
            cls.bank_journal.default_credit_account_id.write({'currency_id': cls.env.ref("base.EUR").id})
            cls.bank_journal.default_debit_account_id.write({'currency_id': cls.env.ref("base.EUR").id})
            cls.bank_journal.write({'currency_id': cls.env.ref("base.EUR").id})

        cls.bank_bnp = cls.env['res.bank'].create({'name': 'BNP Paribas', 'bic': 'GEBABEBB'})

        # Make sure all suppliers have exactly one bank account
        cls.setSingleBankAccountToPartner(cls.asustek_sup, {
            'acc_type': 'iban',
            'partner_id': cls.asustek_sup[0].id,
            'acc_number': 'BE08429863697813',
            'bank_id': cls.bank_bnp.id,
            'currency_id': cls.env.ref('base.USD').id,
        })
        cls.setSingleBankAccountToPartner(cls.supplier, {
            'acc_type': 'bank',
            'partner_id': cls.supplier.id,
            'acc_number': '1234567890',
            'bank_name': 'Mock & Co',
        })

        # Create 1 payment per supplier
        cls.payment_1 = cls.createPayment(cls.asustek_sup, 500)
        cls.payment_1.post()
        cls.payment_2 = cls.createPayment(cls.asustek_sup, 600)
        cls.payment_2.post()
        cls.payment_3 = cls.createPayment(cls.supplier, 700)
        cls.payment_3.post()

        # Get a pain.001.001.03 schema validator
        schema_file_path = get_module_resource('account_sepa', 'schemas', 'pain.001.001.03.xsd')
        cls.xmlschema = etree.XMLSchema(etree.parse(open(schema_file_path)))

    @classmethod
    def setSingleBankAccountToPartner(cls, partner_id, bank_account_vals):
        """ Make sure a partner has exactly one bank account """
        partner_id.bank_ids.unlink()
        return cls.env['res.partner.bank'].create(bank_account_vals)

    @classmethod
    def createPayment(cls, partner, amount):
        """ Create a SEPA credit transfer payment """
        return cls.env['account.payment'].create({
            'journal_id': cls.bank_journal.id,
            'partner_bank_account_id': partner.bank_ids[0].id,
            'payment_method_id': cls.sepa_ct.id,
            'payment_type': 'outbound',
            'payment_date': '2015-04-28',
            'amount': amount,
            'currency_id': cls.env.ref("base.EUR").id,
            'partner_id': partner.id,
            'partner_type': 'supplier',
        })

    def testStandardSEPA(self):
        batch = self.env['account.batch.payment'].create({
            'journal_id': self.bank_journal.id,
            'payment_ids': [(4, payment.id, None) for payment in (self.payment_1 | self.payment_2)],
            'payment_method_id': self.sepa_ct.id,
            'batch_type': 'outbound',
        })

        batch.validate_batch()
        download_wizard = self.env['account.batch.download.wizard'].browse(batch.export_batch_payment()['res_id'])

        self.assertFalse(batch.sct_generic)
        sct_doc = etree.fromstring(base64.b64decode(download_wizard.export_file))
        self.assertTrue(self.xmlschema.validate(sct_doc), self.xmlschema.error_log.last_error)
        self.assertEqual(self.payment_1.state, 'sent')
        self.assertEqual(self.payment_2.state, 'sent')

    def testGenericSEPA(self):
        batch = self.env['account.batch.payment'].create({
            'journal_id': self.bank_journal.id,
            'payment_ids': [(4, payment.id, None) for payment in (self.payment_1 | self.payment_3)],
            'payment_method_id': self.sepa_ct.id,
            'batch_type': 'outbound',
        })

        batch.validate_batch()
        download_wizard = self.env['account.batch.download.wizard'].browse(batch.export_batch_payment()['res_id'])

        self.assertTrue(batch.sct_generic)
        sct_doc = etree.fromstring(base64.b64decode(download_wizard.export_file))
        self.assertTrue(self.xmlschema.validate(sct_doc), self.xmlschema.error_log.last_error)
        self.assertEqual(self.payment_1.state, 'sent')
        self.assertEqual(self.payment_3.state, 'sent')

    def testQRCode(self):
        """Test thats the QR-Code is displayed iff the mandatory fields are
        written and in the good state"""

        form = Form(self.env['account.payment'])
        form.partner_type = 'customer'
        self.assertEqual(form.display_qr_code, False)
        form.partner_type = 'supplier'
        self.assertEqual(form.display_qr_code, False)
        form.payment_method_code == 'manual'
        self.assertEqual(form.display_qr_code, False)
        form.partner_id = self.supplier
        self.assertEqual(form.display_qr_code, True)
        self.assertIn('The SEPA QR Code information is not set correctly', form.qr_code_url, 'A warning should be displayed')
        form.partner_id = self.asustek_sup
        self.assertEqual(form.display_qr_code, True)
        self.assertIn('<img ', form.qr_code_url, 'The QR code should be displayed')
        form.partner_bank_account_id = self.env['res.partner.bank']
        self.assertIn('The SEPA QR Code information is not set correctly', form.qr_code_url, 'A warning should be displayed')
        form.payment_method_id = self.sepa_ct
        self.assertEqual(form.display_qr_code, False)
