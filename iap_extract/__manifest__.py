# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Iap Extract',
    'version': '1.0',
    'category': 'Human Resources/Expenses',
    'summary': 'Common module for requesting data from the extract server',
    'depends': ['base', 'mail'],
    'data': [
        'data/mail_template_data.xml',
    ],
    'auto_install': True,
    'license': 'OEEL-1',
    'assets': {}
}
