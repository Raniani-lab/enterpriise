# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Facebook Event",
    'category': 'Marketing/Social',
    'summary': "Manage your Facebook events",
    'description': """Link your Facebook events within Event.

This module allows you to link your events with your Facebook events. In
addition it allows you to post on your Facebook events, keep your attendees
updated and get valuable insights on engagement.""",
    'depends': ['event', 'social_facebook'],
    'data': [
        'security/ir.model.access.csv',
        'views/assets.xml',
        'views/social_facebook_event_views.xml',
        'views/event_event_views.xml',
        'views/social_post_views.xml',
    ],
    'auto_install': True,
}
