# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Spreadsheet dashboard for human resources",
    'version': '1.0',
    'category': 'Hidden',
    'summary': 'Spreadsheet',
    'description': 'Spreadsheet',
    'depends': ['spreadsheet_dashboard', 'hr_contract_reports'],
    'data': [
        "data/dashboards.xml",
    ],
    'demo': [],
    'installable': True,
    'auto_install': ['hr_contract_reports'],
    'license': 'OEEL-1',
    'assets': {
        'spreadsheet_dashboard.o_spreadsheet': [],
        'web.assets_backend': [],
        'web.assets_qweb': [],
        'web.qunit_suite_tests': [],
        'web.assets_tests': [
            'spreadsheet_dashboard_hr_contract/static/tests/**/*',
        ],
    }
}
