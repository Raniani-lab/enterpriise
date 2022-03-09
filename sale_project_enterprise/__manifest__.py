# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Sale Project Enterprise',
    'category': 'Hidden',
    'depends': ['sale_project', 'project_enterprise'],
    'data': [
    ],
    'demo': [
    ],
    'assets': {
        'web.assets_backend': [
            'sale_project_enterprise/static/src/project_right_panel/**/*.js',
        ],
        'web.assets_qweb': [
            'sale_project_enterprise/static/src/project_right_panel/**/*.xml',
        ],
    },
    'auto_install': True,
    'license': 'OEEL-1',
}
