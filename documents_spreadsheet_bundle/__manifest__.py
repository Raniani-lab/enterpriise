# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Documents Spreadsheet Bundle",
    'version': '1.0',
    'category': 'Productivity/Documents',
    'summary': 'Documents Spreadsheet bundle of assets',
    'description': 'Documents Spreadsheet bundle of assets',
    'depends': ['documents_spreadsheet'],
    'data': [],
    'demo': [],
    'application': False,
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
    'assets': {
        'documents_spreadsheet.o_spreadsheet': [
            'documents_spreadsheet_bundle/static/src/o_spreadsheet/o_spreadsheet.js',
            'documents_spreadsheet_bundle/static/src/**/*.js',
        ],
    'web.assets_qweb': [
        'documents_spreadsheet_bundle/static/src/**/*.xml',
    ],
    }
}
