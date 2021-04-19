# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Appointments',
    'version': '1.0',
    'category': 'Marketing/Online Appointment',
    'sequence': 215,
    'summary': 'Schedule appointments with clients',
    'website': 'https://www.odoo.com/page/appointments',
    'description': """
Allow clients to Schedule Appointments through your Website
-------------------------------------------------------------

""",
    'depends': ['calendar_sms', 'website_enterprise', 'hr'],
    'data': [
        'data/calendar_data.xml',
        'data/website_data.xml',
        'data/mail_data.xml',
        'data/mail_template_data.xml',
        'views/calendar_event_views.xml',
        'views/calendar_appointment_question_views.xml',
        'views/calendar_appointment_type_views.xml',
        'views/calendar_appointment_slot_views.xml',
        'views/calendar_menus.xml',
        'views/calendar_templates_appointments.xml',
        'views/calendar_templates_registration.xml',
        'views/calendar_templates_validation.xml',
        'views/website_templates.xml',
        'wizard/calendar_appointment_share_views.xml',
        'security/calendar_security.xml',
        'security/ir.model.access.csv',
    ],
    'demo': [
        'data/calendar_appointment_demo.xml'
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'OEEL-1',
    'assets': {
        'web.assets_frontend': [
            'website_calendar/static/src/scss/website_calendar.scss',
            'website_calendar/static/src/js/website_calendar_select_appointment_type.js',
            'website_calendar/static/src/js/website_calendar_select_appointment_slot.js',
        ],
        'web_editor.assets_wysiwyg': [
            'website_calendar/static/src/js/wysiwyg.js',
        ],
        'web.assets_backend': [
            'website_calendar/static/src/scss/calendar_appointment_type_views.scss',
        ],
        'website.assets_editor': [
            'website_calendar/static/src/js/website_calendar.editor.js',
        ],
        'web.assets_qweb': [
            'website_calendar/static/src/xml/**/*',
        ],
        'web.assets_tests': [
            'website_calendar/static/tests/tours/*',
        ],
    }
}
