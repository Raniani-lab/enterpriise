# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# YTI FIXME: This module should be named timesheet_enterprise
{
    'name': "Timesheets - Enterprise",
    'summary': "Timesheet Validation and Grid View",
    'description': """
* Timesheet submission and validation
* Activate grid view for timesheets
    """,
    'version': '1.0',
    'depends': ['web_grid', 'hr_timesheet'],
    'category': 'Operations/Timesheets',
    'data': [
        'data/mail_data.xml',
        'data/timesheet_grid_data.xml',
        'security/timesheet_security.xml',
        'views/hr_timesheet_views.xml',
        'views/res_config_settings_views.xml',
        'views/project_task_views.xml',
        'views/assets.xml',
        'wizard/timesheet_validation_views.xml',
        'wizard/project_task_create_timesheet_views.xml',
    ],
    'demo': [
        'data/timesheet_grid_demo.xml',
    ],
    'website': ' https://www.odoo.com/page/timesheet-mobile-app',
    'auto_install': True,
    'application': True,
    'license': 'OEEL-1',
}
