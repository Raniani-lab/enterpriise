# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Spreadsheet",
    'version': '1.0',
    'category': 'Hidden',
    'summary': 'Spreadsheet',
    'description': 'Spreadsheet',
    'depends': ['spreadsheet'],
    'data': [
        'data/spreadsheet_data.xml',
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
    'assets': {
        'spreadsheet.o_spreadsheet': [
            'spreadsheet_edition/static/src/bundle/**/*.js',
        ],
        'web.assets_backend': [
            'spreadsheet_edition/static/src/assets/**/*.js',
            'spreadsheet_edition/static/src/**/*.scss',
        ],
        'web.assets_qweb': [
            'spreadsheet_edition/static/src/**/*.xml',
        ],
        'web.qunit_suite_tests': [
            'spreadsheet_edition/static/tests/**/*',
            ('include', 'spreadsheet.o_spreadsheet'),
        ],
        'web.qunit_mobile_suite_tests': [
            'spreadsheet_edition/static/tests/utils/mock_server.js',
        ],
    }
}
