# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class SpreadsheetAccountGroupTest(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        user_types = cls.env["account.account.type"].create(
            [
                {"name": "First Type", "internal_group": "income", "type": "other"},
                {
                    "name": "Second Type",
                    "internal_group": "income",
                    "type": "other",
                },
            ]
        )
        cls.user_type_1 = user_types[0]
        cls.user_type_2 = user_types[1]

        cls.env["account.account"].create(
            {
                "company_id": cls.env.user.company_id.id,
                "name": "spreadsheet revenue Company 1",
                "user_type_id": cls.user_type_1.id,
                "code": "123",
            }
        )

        cls.env["account.account"].create(
            {
                "company_id": cls.env.user.company_id.id,
                "name": "spreadsheet expense Company 1",
                "user_type_id": cls.user_type_2.id,
                "code": "456",
            }
        )

        cls.env["account.account"].create(
            {
                "company_id": cls.env.user.company_id.id,
                "name": "spreadsheet revenue Company 2",
                "user_type_id": cls.user_type_1.id,
                "code": "789",
            }
        )

    def test_fetch_account_no_group(self):
        self.assertEqual(self.env["account.account"].get_account_group([]), [])

    def test_fetch_account_one_group(self):
        self.assertEqual(
            self.env["account.account"].get_account_group([self.user_type_2.id]),
            [["456"]],
        )

    def test_group_with_no_account(self):
        user_type = self.env["account.account.type"].create(
            [{"name": "First Type", "internal_group": "income", "type": "receivable"}]
        )
        self.assertEqual(
            self.env["account.account"].get_account_group([user_type.id]), [[]]
        )

    def test_with_wrong_account_type_id(self):
        self.assertEqual(self.env["account.account"].get_account_group([999999]), [[]])

    def test_group_with_multiple_accounts(self):
        self.assertEqual(
            self.env["account.account"].get_account_group([self.user_type_1.id]),
            [["123", "789"]],
        )

    def test_response_is_ordered(self):
        o1_codes_1, o1_codes_2 = self.env["account.account"].get_account_group(
            [self.user_type_1.id, self.user_type_2.id]
        )
        o2_codes_2, o2_codes_1 = self.env["account.account"].get_account_group(
            [self.user_type_2.id, self.user_type_1.id]
        )
        self.assertEqual(o1_codes_1, o2_codes_1)
        self.assertEqual(o1_codes_2, o2_codes_2)
