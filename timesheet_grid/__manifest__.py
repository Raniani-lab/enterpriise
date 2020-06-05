# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# YTI FIXME: This module should be named timesheet_enterprise
{
    'name': "Timesheets",
    'summary': "Timesheet Validation and Grid View",
    'description': """
* Timesheet submission and validation
* Activate grid view for timesheets
    """,
    'version': '1.0',
    'depends': ['web_grid', 'hr_timesheet', 'timer'],
    'category': 'Services/Timesheets',
    'data': [
        'data/mail_data.xml',
        'security/timesheet_security.xml',
        'views/hr_timesheet_views.xml',
        'views/res_config_settings_views.xml',
        'views/assets.xml',
    ],
    'demo': [
        'data/timesheet_grid_demo.xml',
    ],
    'qweb': [
        'static/src/xml/timesheet_grid.xml',
    ],
    'website': ' https://www.odoo.com/page/timesheet-mobile-app',
    'auto_install': ['web_grid', 'hr_timesheet'],
    'application': True,
    'license': 'OEEL-1',
    'pre_init_hook': 'pre_init_hook',
    'uninstall_hook': 'uninstall_hook',
}
