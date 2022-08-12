# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Homeworking",
    'summary': """Manage Homeworking policy""",
    'description': """Manage Homeworking policy""",
    'version': '1.0',
    'category': 'Human Resources/Employees',
    'depends': ['hr', 'web_gantt'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'wizard/change_homeworking_location_wizard_views.xml',
        'views/hr_employee_public_views.xml',
        'views/hr_employee_views.xml',
        'views/hr_department_views.xml',
        'views/homeworking_exception_views.xml',
        'views/homeworking_location_views.xml',
        'views/homeworking_schedule_views.xml',
        'views/res_users_views.xml',
        'views/homeworking_entry_views.xml',
        'data/hr_homeworking_data.xml',
        'data/ir_cron_data.xml',
    ],
    'demo': [
        'data/hr_homeworking_demo.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'hr_homeworking/static/src/js/**/*',
            'hr_homeworking/static/src/scss/**/*',
            'hr_homeworking/static/src/xml/**/*',
        ],
    },
    'post_init_hook': '_initialize_homeworking_locations',
    'installable': True,
    'application': True,
    'license': 'OEEL-1',
}
