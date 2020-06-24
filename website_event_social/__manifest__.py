# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Schedule push notifications on attendees',
    'category': 'Marketing/Events',
    'sequence': 1020,
    'version': '1.0',
    'summary': 'Bridge module to push notifications to event attendees',
    'website': 'https://www.odoo.com/page/events',
    'description': "",
    'depends': [
        'website_event',
        'social_push_notifications',
    ],
    'data': [
    ],
    'demo': [
    ],
    'application': False,
    'installable': True,
}
