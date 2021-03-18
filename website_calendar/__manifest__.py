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
        'views/assets.xml',
        'views/calendar_event_views.xml',
        'views/calendar_appointment_question_views.xml',
        'views/calendar_appointment_type_views.xml',
        'views/calendar_menus.xml',
        'views/calendar_templates_appointments.xml',
        'views/calendar_templates_registration.xml',
        'views/calendar_templates_validation.xml',
        'views/website_templates.xml',
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
}
