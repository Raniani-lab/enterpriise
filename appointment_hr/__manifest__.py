# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Employees on Appointments",
    'version': "1.0",
    'category': 'Marketing/Online Appointment',
    'sequence': 2140,
    'summary': "Manage Appointments with Employees",
    'website': 'https://www.odoo.com/app/appointments',
    'description': """
Take into account the working schedule (sick leaves, part time, ...) of employees when scheduling appointments
--------------------------------------------------------------------------------------------------------------
""",
    'depends': ['appointment', 'hr'],
    'data': [
        'views/appointment_type_views.xml'
    ],
    'application': False,
    'auto_install': True,
    'license': 'OEEL-1',
    'assets': {
        'web.assets_backend': [
            'appointment_hr/static/src/js/calendar_controller.js',
            'appointment_hr/static/src/js/calendar_model.js',
            'appointment_hr/static/src/js/calendar_renderer.js',
        ],
        'web.assets_qweb': [
            'appointment_hr/static/src/xml/**/*',
        ],
        'web.qunit_suite_tests': [
            'appointment_hr/static/tests/*',
        ],
    }
}
