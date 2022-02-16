# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Website Appointments',
    'version': '1.0',
    'category': 'Marketing/Online Appointment',
    'sequence': 215,
    'website': 'https://www.odoo.com/page/appointments',
    'description': """
Allow clients to Schedule Appointments through your Website
-------------------------------------------------------------

""",
    'depends': ['appointment', 'website_enterprise'],
    'data': [
        'data/calendar_data.xml',
        'data/website_data.xml',
        'views/appointment_type_views.xml',
        'views/calendar_menus.xml',
        'views/appointment_templates_appointments.xml',
        'views/appointment_templates_registration.xml',
        'views/appointment_templates_validation.xml',
        'views/website_templates.xml',
        'security/calendar_security.xml',
    ],
    'demo': [
        'data/appointment_demo.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': True,
    'post_init_hook': '_post_init_website_appointment',
    'license': 'OEEL-1',
    'assets': {
        'website.assets_editor': [
            'website_appointment/static/src/js/website_appointment.editor.js',
        ],
        'web.assets_tests': [
            'website_appointment/static/tests/tours/*',
        ],
        'web.assets_frontend': [
            'website_appointment/static/src/scss/website_appointment_editor.scss',
            'website_appointment/static/src/js/appointment_select_appointment_slot.js',
        ],
        'web.assets_qweb': [
            'website_appointment/static/src/xml/**/*',
        ],
    }
}
