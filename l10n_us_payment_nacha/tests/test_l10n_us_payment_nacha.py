# coding: utf-8
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged

import datetime
from freezegun import freeze_time

@tagged('post_install', '-at_install')
class TestNacha(AccountTestInvoicingCommon):
    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_generic_coa.configurable_chart_template'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.company_data["default_journal_bank"].write({
            "nacha_immediate_destination": "IMM_DESTINATION",
            "nacha_immediate_origin": "IMM_ORIGIN",
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
        batch = self.env["account.batch.payment"].create({
            "journal_id": self.company_data["default_journal_bank"].id,
            "batch_type": "outbound",
            "payment_ids": [
                (0, 0, {
                    "partner_id": self.partner_a.id,
                    "partner_bank_id": self.bank.id,
                    "ref": "test1",
                    "amount": 123,
                    "payment_type": "outbound",
                    "date": datetime.datetime.today(),
                }),
                (0, 0, {
                    "partner_id": self.partner_b.id,
                    "partner_bank_id": self.bank.id,
                    "ref": "test2",
                    "amount": 456,
                    "payment_type": "outbound",
                    "date": datetime.datetime.today(),
                }),
            ]
        })

        expected = [
            # header
            "101IMM_DESTINIMM_ORIGIN2011301945A094101DESTINATION            company_1_data         {:8d}".format(batch.id),
            # batch header for payment "test1"
            "5225company_1_data                      COMPANY_IDPPDtest1     201130201130   1ORIGINAT0000000",
            # entry detail for payment "test1"
            "627123456789987654321        0000012300               partner_a               0ORIGINAT0000000",
            # batch control record for payment "test1"
            "82250000010000000036000000012300000000000000COMPANY_ID                         ORIGINAT0000000",
            # batch header for payment "test2"
            "5225company_1_data                      COMPANY_IDPPDtest2     201130201130   1ORIGINAT0000001",
            # entry detail for payment "test2"
            "627123456789987654321        0000045600               partner_b               0ORIGINAT0000000",
            # batch control record for payment "test2"
            "82250000010000000036000000045600000000000000COMPANY_ID                         ORIGINAT0000001",
            # file control record
            "9000002000004000000020000000072000000000579000000000000                                       ",
        ]

        for generated, expected in zip(batch._generate_nacha_file().splitlines(), expected):
            self.assertEqual(generated, expected, "Generated line in NACHA file does not match expected.")
