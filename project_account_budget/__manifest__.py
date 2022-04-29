# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Project Budget",
    'version': '1.0',
    'summary': "Project account budget",
    'category': 'Services/Project',
    'depends': ['account_budget', 'project_enterprise'],
    'data': [
        'views/project_views.xml',
        'views/account_budget_views.xml',
    ],
    'demo': [
        'data/account_budget_demo.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'project_account_budget/static/src/right_panel/project_right_panel.js',
        ],
        'web.assets_qweb': [
            'project_account_budget/static/src/right_panel/project_right_panel.xml',
        ],
    },
    'auto_install': True,
    'license': 'OEEL-1',
}
