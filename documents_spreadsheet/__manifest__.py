# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Documents Spreadsheet",
    'version': '1.0',
    'category': 'Productivity/Documents',
    'summary': 'Documents Spreadsheet',
    'description': 'Documents Spreadsheet',
    'depends': ['documents'],
    'data': [
        'data/documents_data.xml',
        'security/ir.model.access.csv',
        'views/assets.xml',
        'views/documents_views.xml',
    ],
    'qweb': [
        'static/src/xml/*.xml',
    ],
    'application': False,
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
}
