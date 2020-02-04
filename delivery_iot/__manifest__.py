# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "IoT for Delivery",
    'description': "Allows using iot devices, such as scales, for delivery operations.",
    'category': 'Manufacturing/Internet of Things (IoT)',
    'version': '1.0',
    'depends': ['iot', 'delivery'],
    'data': [
        'wizard/choose_delivery_package_views.xml',
        'views/iot_views.xml',
        'views/stock_picking_views.xml',
        'views/assets.xml',
    ],
    'qweb': [
        'static/src/xml/delivery_iot.xml',
    ],
    'license': 'OEEL-1',
    'auto_install': True,
}
