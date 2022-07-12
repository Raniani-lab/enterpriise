from odoo.tests.common import TransactionCase

class TestCurrencyRates(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super(TestCurrencyRates, cls).setUpClass()
        cls.env["res.currency"].create(
            [
                {
                    "name": "MC1",
                    "symbol": ":D",
                    "rounding": 0.001,
                },
                {
                    "name": "MC2",
                    "symbol": "§",
                },
            ]
        )


    def test_get_currencies_for_spreadsheet(self):
        self.assertEqual(
            self.env["res.currency"].get_currencies_for_spreadsheet(["MC1", "MC2"]),
            [
                {
                    "code": "MC1",
                    "symbol": ":D",
                    "decimalPlaces": 3,
                    "position": "after",
                },
                {
                    "code": "MC2",
                    "symbol": "§",
                    "decimalPlaces": 2,
                    "position": "after",
                },
            ],
        )

        self.assertEqual(
            self.env["res.currency"].get_currencies_for_spreadsheet(["ProbablyNotACurrencyName?", "MC2"]),
            [
                None,
                {
                    "code": "MC2",
                    "symbol": "§",
                    "decimalPlaces": 2,
                    "position": "after",
                },
            ],
        )
