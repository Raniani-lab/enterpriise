from odoo.tests.common import TransactionCase

CURRENT_USD = 1.5
CURRENT_EUR = 1
CURRENT_CAD = 1.2
USD_11 = 1.8
CAD_11 = 1.9
CAD_03 = 2

class TestCurrencyRates(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super(TestCurrencyRates, cls).setUpClass()
        usd = cls.env.ref("base.USD")
        eur = cls.env.ref("base.EUR")
        cad = cls.env.ref("base.CAD")
        cls.env.company.currency_id = eur.id
        cls.env["res.currency.rate"].create([{
            "currency_id": usd.id,
            "rate": CURRENT_USD,
        }, {
            "currency_id": cad.id,
            "rate": CURRENT_CAD,
        }, {
            "name": "2021-11-11",
            "currency_id": usd.id,
            "rate": USD_11,
        }, {
            "name": "2021-11-11",
            "currency_id": cad.id,
            "rate": CAD_11,
        }, {
            "name": "2022-03-03",
            "currency_id": usd.id,
            "rate": CAD_03,
        }])

    def test_currency_without_date(self):
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet("USD", "EUR"), CURRENT_EUR/CURRENT_USD)
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet("EUR", "USD"), CURRENT_USD)
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet("USD", "CAD"), CURRENT_CAD/CURRENT_USD)

    def test_currency_with_date(self):
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet("USD", "EUR", "2021-11-11"), CURRENT_EUR/USD_11)
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet("EUR", "USD", "2021-11-11"), USD_11)
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet("USD", "CAD", "2021-11-11"), CAD_11/USD_11)

    def test_currency_invalid_args(self):
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet("INVALID", "EUR"), False)
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet("EUR", "INVALID"), False)
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet("INVALID", "USD"), False)
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet("USD", "INVALID"), False)
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet(False, "EUR"), False)
        self.assertEqual(self.env["res.currency.rate"]._get_rate_for_spreadsheet("EUR", False), False)
