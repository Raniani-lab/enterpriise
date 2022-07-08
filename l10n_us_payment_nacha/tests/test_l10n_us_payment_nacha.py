# coding: utf-8
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged

import datetime
from freezegun import freeze_time


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestNacha(AccountTestInvoicingCommon):
    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_generic_coa.configurable_chart_template'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.company_data["default_journal_bank"].write({
            "nacha_immediate_destination": "IMM_DESTINATION",
            "nacha_immediate_origin": "IMM_ORIG",
            "nacha_destination": "DESTINATION",
            "nacha_company_identification": "COMPANY_ID",
            "nacha_origination_dfi_identification": "ORIGINATION_DFI",
        })

        cls.bank = cls.env["res.partner.bank"].create({
            "partner_id": cls.partner_a.id,
            "acc_number": "987654321",
            "aba_routing": "123456789",
        })

    @freeze_time("2020-11-30 19:45:00")
    def testGenerateNachaFile(self):

        def create_payment(partner, amount, ref):
            payment = self.env['account.payment'].create({
                "partner_id": partner.id,
                "partner_bank_id": self.bank.id,
                "ref": ref,
                "amount": amount,
                "payment_type": "outbound",
                "date": datetime.datetime.today(),
            })
            payment.action_post()
            return payment

        batch = self.env["account.batch.payment"].create({
            "journal_id": self.company_data["default_journal_bank"].id,
            "batch_type": "outbound",
        })
        batch.payment_ids += create_payment(self.partner_a, 123.45, 'test1')
        batch.payment_ids += create_payment(self.partner_b, 456.78, 'test2')

        expected = [
            # header
            "101IMM_DESTIN  IMM_ORIG2011301945A094101DESTINATION            company_1_data         {:8d}".format(batch.id),
            # batch header for payment "test1"
            "5220company_1_data                      COMPANY_IDPPDtest1     201130201130   1ORIGINAT0000000",
            # entry detail for payment "test1"
            "622123456789987654321        0000012345               partner_a               0ORIGINAT0000000",
            # batch control record for payment "test1"
            "82200000010000000036000000000000000000012345COMPANY_ID                         ORIGINAT0000000",
            # batch header for payment "test2"
            "5220company_1_data                      COMPANY_IDPPDtest2     201130201130   1ORIGINAT0000001",
            # entry detail for payment "test2"
            "622123456789987654321        0000045678               partner_b               0ORIGINAT0000000",
            # batch control record for payment "test2"
            "82200000010000000036000000000000000000045678COMPANY_ID                         ORIGINAT0000001",
            # file control record
            "9000002000004000000020000000072000000000000000000058023                                       ",
        ]

        for generated, expected in zip(batch._generate_nacha_file().splitlines(), expected):
            self.assertEqual(generated, expected, "Generated line in NACHA file does not match expected.")
