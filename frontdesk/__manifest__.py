# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Frontdesk',
    'category': 'Human Resources/Frontdesk',
    'description': 'A comprehensive front desk management system that enables guests to effortlessly check in and out while ensuring seamless notifications for hosts.',
    'summary': 'Visitor management system',
    'installable': True,
    'application': True,
    'license': 'OEEL-1',
    'version': '1.0',
    'depends': ['hr'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'views/frontdesk_report_views.xml',
        'views/frontdesk_drink_views.xml',
        'views/frontdesk_visitor_views.xml',
        'views/frontdesk_frontdesk_views.xml',
        'views/frontdesk_menus.xml',
        'views/frontdesk_templates.xml',
        'views/frontdesk_qr_expiration.xml',
        'data/mail_template_data.xml',
        'data/sms_template_data.xml',
        'data/frontdesk_data.xml',
    ],
    'demo': [
        'demo/frontdesk_demo.xml',
    ],
    'assets': {
        'frontdesk.assets_frontdesk': [
            'web/static/lib/zxing-library/zxing-library.js',
            'frontdesk/static/src/**/*',
        ],
        'web.assets_tests': [
            'frontdesk/static/tests/tours/**/*',
        ],
    },
}
