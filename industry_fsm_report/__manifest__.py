# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Field Service Reports',
    'category': 'Hidden',
    'summary': 'Create Reports for Field service workers',
    'description': """
Create Reports for Field Service
================================

""",
    'depends': ['worksheet', 'industry_fsm', 'web_studio'],
    'data': [
        'security/industry_fsm_report_security.xml',
        'security/ir.model.access.csv',
        'views/project_views.xml',
        'views/project_portal_templates.xml',
        'views/project_sharing_views.xml',
        'report/worksheet_custom_report_templates.xml',
        'data/fsm_report_data.xml',
    ],
    'demo': ['data/fsm_report_demo.xml'],
    'post_init_hook': 'post_init',
    'auto_install': ['industry_fsm', 'web_studio'],
    'license': 'OEEL-1',
}
