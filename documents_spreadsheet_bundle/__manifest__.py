# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# This module is a convenience module, directly brother of documents_spreadsheet
# Uninstalling this module without uninstalling documents_spreadsheet doesn't make sense,
# as the user would have the menus available to add or use a spreadsheet but would not
# have the action to open a spreadsheet available
{
    'name': "Documents Spreadsheet Bundle",
    'version': '1.0',
    'category': 'Technical',
    'summary': 'Documents Spreadsheet bundle of assets',
    'description': 'Documents Spreadsheet bundle of assets. The goal of this module is to separate from documents_spreadsheet what can and cannot be lazy loaded.',
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
        'web.qunit_suite_tests': [
            'documents_spreadsheet_bundle/static/tests/**/*',
            ('include', 'documents_spreadsheet.o_spreadsheet')
        ]
    }
}
