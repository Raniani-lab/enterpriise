# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Internet of Things',
    'category': 'Manufacturing/Internet of Things (IoT)',
    'sequence': 250,
    'summary': 'Basic models and helpers to support Internet of Things.',
    'description': """
This module provides management of your IoT Boxes inside Odoo.
""",
    'depends': ['mail','web'],
    'data': [
        'wizard/iot_wizard.xml',
        'views/iot_views.xml',
        'security/ir.model.access.csv',
        'security/iot_security.xml',
    ],
    'demo': [
        'data/iot_demo.xml'
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'OEEL-1',
}
