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
        'security/security.xml',
        'views/documents_views.xml',
        'views/documents_templates.xml',
        'views/res_config_settings_views.xml',
        'wizard/save_spreadsheet_template.xml',
    ],
    'demo': [
        'demo/documents_demo_data.xml'
    ],

    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
    'assets': {
        'documents_spreadsheet.o_spreadsheet': [
            'documents_spreadsheet/static/src/bundle/o_spreadsheet/o_spreadsheet.js',
            'documents_spreadsheet/static/src/bundle/**/*.js',
        ],
        'web.assets_backend': [
            'documents_spreadsheet/static/src/assets/**/*.js',
            'documents_spreadsheet/static/src/assets/**/*.scss',
            'documents_spreadsheet/static/src/scss/**/*',
            'documents_spreadsheet/static/src/bundle/**/*.scss',
        ],
        'web.assets_qweb': [
            # Load all o_spreadsheet templates first to allow to inherit them
            'documents_spreadsheet/static/src/bundle/o_spreadsheet/o_spreadsheet.xml',
            'documents_spreadsheet/static/src/**/*.xml',
        ],
        'web.assets_tests': [
            'documents_spreadsheet/static/tests/tours/*',
        ],
        'web.qunit_suite_tests': [
            'documents_spreadsheet/static/tests/**/*',
            ('include', 'documents_spreadsheet.o_spreadsheet')
        ]
    }
}
