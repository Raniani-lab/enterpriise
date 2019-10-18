# coding: utf-8

from odoo.tests.common import TransactionCase
from odoo import fields

from ..models.res_config_settings import BANXICO_DATE_FORMAT

try:
    from unittest.mock import patch
except ImportError:
    from mock import patch


def mocked_requests_get(*args, **kwargs):
    class MockResponse:
        def __init__(self, json_data, status_code, special_value=None):
            self.json_data = json_data
            self.status_code = status_code

        def json(self):
            return self.json_data

        def raise_for_status(self):
            return True

    url = args[0]
    if url.startswith('https://www.banxico.org.mx/SieAPIRest/service/v1/series/'):
        date = fields.Date.from_string(fields.Date.today()).strftime(BANXICO_DATE_FORMAT)
        return MockResponse({'bmx': {'series': [
            # USD
            {'datos': [{'dato': '21.7204', 'fecha': date}],
             'idSerie': 'SF60653',
             'titulo': 'Tipos de Cambio para Revalorización de '
                       'Balance del Banco de México USD E.U.A. '
                       '(Dólar) Tipo en pesos'},
            # EUR
            {'datos': [{'dato': '23.0649', 'fecha': date}],
             'idSerie': 'SF46410',
             'titulo': 'Tipos de Cambio para Revalorización de '
                       'Balance del Banco de México EUR U.Mon.Europea '
                       '(Euro 3/) Tipo en pesos'},
            # GBP
            {'datos': [{'dato': '26.3893', 'fecha': date}],
             'idSerie': 'SF46407',
             'titulo': 'Tipos de Cambio para Revalorización de '
                       'Balance del Banco de México STG Gran Bretaña '
                       '(Libra Esterlina) Tipo en pesos'},
            # CAD
            {'datos': [{'dato': '16.4474', 'fecha': date}],
             'idSerie': 'SF60632',
             'titulo': 'Tipos de Cambio para Revalorización de '
                       'Balance del Banco de México CAD Canadá '
                       '(Dólar) Tipo en pesos'},
            # JPY
            {'datos': [{'dato': '0.1889', 'fecha': date}],
             'idSerie': 'SF46406',
             'titulo': 'Tipos de Cambio para Revalorización de '
                       'Balance del Banco de México JPY Japón (Yen) '
                       'Tipo en pesos'}]}}, 200)
    return MockResponse(None, 404)


def mocked_requests_get_ne(*args, **kwargs):
    mock_response = mocked_requests_get(*args, **kwargs)
    mock_response.json_data['bmx']['series'][3]['datos'][0]['dato'] = 'N/E'
    return mock_response


class BanxicoTest(TransactionCase):
    def setUp(self):
        super(BanxicoTest, self).setUp()
        self.company = self.env['res.company'].create({
            'name': 'Banxico Test Company',
            'country_id': self.env.ref('base.us').id,
            'currency_id': self.env.ref('base.USD').id,
        })
        self.env.user.company_id = self.company
        self.company.currency_provider = 'banxico'
        self.user_root = self.env.ref('base.user_root')
        self.mxn = self.env.ref('base.MXN')
        self.usd = self.env.ref('base.USD')
        self.eur = self.env.ref('base.EUR')
        self.cad = self.env.ref('base.CAD')
        self.jpy = self.env.ref('base.JPY')
        self.gbp = self.env.ref('base.GBP')
        self.company_1 = self.env['res.company'].create({
            'name': 'Company 1',
            'country_id': self.env.ref('base.mx').id,
            'currency_id': self.mxn.id,
            'currency_provider': 'banxico',
            'currency_interval_unit': 'daily',
        })
        self.company_2 = self.env['res.company'].create({
            'name': 'Company 2',
            'country_id': self.env.ref('base.mx').id,
            'currency_id': self.mxn.id,
            'currency_provider': 'banxico',
            'currency_interval_unit': 'daily',
        })
        self.foreign_currencies = [
            self.usd, self.eur, self.cad, self.jpy, self.gbp]
        self.foreign_expected_rates = [
            21.7204, 23.0649, 16.4474, 0.1889, 26.3893]
        self.mxn.active = True
        for currency in self.foreign_currencies:
            currency.active = True

    def set_rate(self, currency, rate):
        currency.rate_ids.unlink()
        currency.rate_ids = self.env['res.currency.rate'].create({
            'rate': rate,
            'currency_id': currency.id,
            'name': fields.Datetime.now().replace(hour=0, minute=0, second=0),
            'company_id': self.company.id,
        })

    def test_banxico_currency_update_nomxn(self):
        self.company.currency_id = self.eur
        self.test_banxico_currency_update()

    def test_banxico_currency_update(self):
        self.company.currency_id = self.mxn
        # Using self.usd.rate=1 and self.mxn.rate != 1
        self.set_rate(self.usd, 1.0)
        self.assertEqual(self.usd.rate, 1.0)
        self.set_rate(self.mxn, 10.0)
        self.assertEqual(self.mxn.rate, 10.0)
        with patch('requests.get', side_effect=mocked_requests_get):
            self.company.update_currency_rates()
        self.assertNotEqual(self.usd.rate, 1.0)
        self.assertNotEqual(self.mxn.rate, 10.0)
        foreigns1 = [foreign_currency._convert(1.0, self.mxn, company=self.company, date=fields.Date.today())
                     for foreign_currency in self.foreign_currencies]

        # Using self.mxn.rate=1 and self.usd.rate != 1
        self.set_rate(self.mxn, 1.0)
        self.assertEqual(self.mxn.rate, 1.0)
        self.set_rate(self.usd, 0.1)
        self.assertEqual(self.usd.compare_amounts(self.usd.rate, 0.1), 0)
        with patch('requests.get', side_effect=mocked_requests_get):
            self.company.update_currency_rates()
        self.assertEqual(self.mxn.rate, 1.0)
        self.assertNotEqual(self.usd.rate, 1.0 / 10.0)
        foreigns2 = [foreign_currency._convert(1.0, self.mxn, company=self.company, date=fields.Date.today())
                     for foreign_currency in self.foreign_currencies]
        for curr, foreign1, foreign2 in zip(self.foreign_currencies, foreigns1, foreigns2):
            self.assertEqual(curr.compare_amounts(foreign1, foreign2), 0,
                             "%s diff rate %s != %s" % (curr.name, foreign1, foreign2))
        # Compare expected xml mocked rate values vs real ones
        for curr, real_rate, expected_rate in zip(self.foreign_currencies, foreigns1, self.foreign_expected_rates):
            self.assertEqual(curr.compare_amounts(real_rate, expected_rate), 0,
                             "%s diff rate %s != %s" % (curr.name, real_rate, expected_rate))

    def test_banxico_without_rate(self):
        """In some cases Banxico return N/E to the rates, in that cases is not
        changed the rate. In that cases, rate is not added"""
        self.set_rate(self.mxn, 1)
        self.assertEqual(self.mxn.rate, 1)
        self.cad.rate_ids.unlink()
        with patch('requests.get', side_effect=mocked_requests_get_ne):
            self.company.update_currency_rates()
        self.assertFalse(self.cad.rate_ids)

    def test_banxico_multicompany(self):
        companies = self.env['res.company']
        companies |= self.company_2
        companies |= self.company_1

        # Let us switch to  company_2
        self.user_root.write({'company_id': self.company_2.id})

        # Checking company_2 & company_1 has USD as Currency
        self.assertEqual(self.company_2.currency_id.id, self.mxn.id)
        self.assertEqual(self.company_1.currency_id.id, self.mxn.id)

        # Checking company_2 & company_1 has banxico as Currency Provider
        self.assertEqual(self.company_2.currency_provider, 'banxico')
        self.assertEqual(self.company_1.currency_provider, 'banxico')

        # Checking company_2 & company_1 have no rates for USD currency
        self.assertFalse(self.usd.rate_ids.filtered(lambda r: r.company_id.id == self.company_2.id))
        self.assertFalse(self.usd.rate_ids.filtered(lambda r: r.company_id.id == self.company_1.id))

        # Let us fetch the newest USD rates for company_2 & company_1
        with patch('requests.get', side_effect=mocked_requests_get):
            companies.update_currency_rates()
        self.assertEqual(len(self.usd.rate_ids.filtered(lambda r: r.company_id.id == self.company_2.id)), 1)
        self.assertEqual(len(self.usd.rate_ids.filtered(lambda r: r.company_id.id == self.company_1.id)), 1)

        # Let us switch from company_1 to company_2, delete the rates for USD
        # and set company_1's provider to None
        self.user_root.write({'company_id': self.company_2.id})
        self.usd.rate_ids.filtered(lambda r: r.name == fields.Date.today()).unlink()
        self.company_1.write({'currency_provider': False})

        self.assertEqual(len(self.usd.rate_ids.filtered(lambda r: r.company_id.id == self.company_2.id)), 0)
        self.assertEqual(len(self.usd.rate_ids.filtered(lambda r: r.company_id.id == self.company_1.id)), 0)

        # Update the currency rates, as banxico is only set in company_2 then
        # company_1 is left without currency rates
        with patch('requests.get', side_effect=mocked_requests_get):
            companies.update_currency_rates()

        self.assertEqual(len(self.usd.rate_ids.filtered(lambda r: r.company_id.id == self.company_2.id)), 1)
        self.assertEqual(len(self.usd.rate_ids.filtered(lambda r: r.company_id.id == self.company_1.id)), 0)
