# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import requests
import json

from unittest.mock import patch
from contextlib import contextmanager
from odoo.addons.website_sale_delivery.controllers.main import WebsiteSaleDelivery
from odoo.addons.website.tools import MockRequest
from odoo.tests import TransactionCase, tagged


@contextmanager
def _mock_call():
    def _mock_request(*args, **kwargs):
        method = kwargs.get('method') or args[0]
        url = kwargs.get('url') or args[1]
        responses = {
            'get': {
                'service-points': [{
                    'id': 11238037,
                    'code': '637432',
                    'is_active': True,
                    'shop_type': '16',
                    'extra_data': {'shop_type': '16'},
                    'name': 'STATION AVIA',
                    'street': 'CHAUSSÉE DE NAMUR 67',
                    'house_number': '',
                    'postal_code': '1367',
                    'city': 'RAMILLIES',
                    'latitude': '50.634530',
                    'longitude': '4.864700',
                    'email': '', 'phone': '',
                    'homepage': '', 'carrier':
                    'bpost', 'country': 'BE',
                    'formatted_opening_times': {'0': ['07:00 - 18:30'], '1': ['07:00 - 18:30'], '2': ['07:00 - 18:30'], '3': ['07:00 - 18:30'], '4': ['08:00 - 14:00', '15:00 - 18:00'], '5': ['09:00 - 16:00'], '6': []},
                    'open_tomorrow': True,
                    'open_upcoming_week': True,
                    'distance': 765}],
            },
            'post': {
            }
        }

        for endpoint, content in responses[method].items():
            if endpoint in url:
                response = requests.Response()
                response._content = json.dumps(content).encode()
                response.status_code = 200
                return response

        raise Exception('unhandled request url %s' % url)

    with patch.object(requests.Session, 'request', _mock_request):
        yield


@tagged('post_install', '-at_install')
class TestWebsiteDeliverySendcloudLocationsController(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.website = cls.env.ref('website.default_website')
        cls.your_company = cls.env.ref("base.main_partner")
        cls.warehouse_id = cls.env['stock.warehouse'].search([('company_id', '=', cls.your_company.id)], limit=1)
        cls.your_company.write({'name': 'Odoo SA',
                                'country_id': cls.env.ref('base.be').id,
                                'street': 'Chaussée de Namur 40',
                                'street2': False,
                                'state_id': False,
                                'city': 'Ramillies',
                                'zip': 1367,
                                'phone': '081813700',
                                })
        # deco_art will be in europe
        cls.eu_partner = cls.env.ref('base.res_partner_2')
        cls.eu_partner.write({
            'country_id': cls.env.ref('base.nl').id,
            'zip': '1367',
            'state_id': False,
            'country_code': 'BE',
            'street': 'Rue des Bourlottes 9',
            'city': 'Ramillies'
        })

        # partner in us (azure)
        cls.us_partner = cls.env.ref('base.res_partner_12')

        cls.product_to_ship1 = cls.env["product.product"].create({
            'name': 'Door with wings',
            'type': 'consu',
            'weight': 10.0
        })

        shipping_product = cls.env['product.product'].create({
            'name': 'SendCloud Delivery',
            'type': 'service'
        })

        uom = cls.env['uom.uom'].search([('name', '=', 'm')])

        cls.sendcloud = cls.env['delivery.carrier'].create({
            'delivery_type': 'sendcloud',
            'product_id': shipping_product.id,
            'sendcloud_public_key': 'mock_key',
            'sendcloud_secret_key': 'mock_key',
            'name': 'SendCloud',
            'sendcloud_use_locations': True,
            'sendcloud_locations_radius_value': 1000,
            'sendcloud_locations_radius_unit': uom.id,
            'sendcloud_locations_id': 1
        })

        cls.payment_provider = cls.env['payment.provider'].create({'name': 'test'})

        cls.partner = cls.env['res.partner'].create({'name': 'testestset'})

        cls.currency = cls.env['res.currency'].create({'name': 'testestset', 'symbol': '€'})

        cls.transaction = cls.env['payment.transaction'].create({
            'state': 'draft',
            'provider_id': cls.payment_provider.id,
            'partner_id': cls.partner.id,
            'currency_id': cls.currency.id,
            'amount': 42
        })

        cls.order = cls.env['sale.order'].create({
            'carrier_id': cls.sendcloud.id,
            'partner_id': cls.env.user.partner_id.id,
            'partner_shipping_id': cls.eu_partner.id,
            'transaction_ids': [cls.transaction.id]
        })

    def test_controller_pickup_location(self):
        with MockRequest(self.env, website=self.website, sale_order_id=self.order.id):
            self.assertEqual({}, WebsiteSaleDelivery.get_access_point(self))
            with _mock_call():
                close_locations = WebsiteSaleDelivery.get_close_locations(self)
                self.assertNotEqual({}, WebsiteSaleDelivery.set_access_point(self, access_point_encoded=close_locations["partner_address"]))
                self.assertEqual('Rue des Bourlottes 9  1367 NL', self.order.access_point_address)
