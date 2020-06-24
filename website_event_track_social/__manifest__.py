# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Push notification to track listeners',
    'category': 'Marketing/Events',
    'sequence': 1021,
    'version': '1.0',
    'summary': 'Send reminder push notifications to event attendees based on wishlisted tracks.',
    'website': 'https://www.odoo.com/page/events',
    'description': "",
    'depends': [
        'website_event_social',
        'website_event_track_online',
    ],
    'data': [
    ],
    'demo': [
    ],
    'application': False,
    'installable': True,
}
