# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Meeting Rooms',
    'summary': 'Manage Meeting Rooms',
    'description': 'Experience the Ease of Booking Meeting Rooms with Real-Time Availability Display.',
    'category': 'Services/Room',
    'version': '1.0',
    'depends': ['mail'],
    'data': [
        'views/room_booking_views.xml',
        'views/room_room_views.xml',
        'views/room_menus.xml',
        'views/room_booking_templates_frontend.xml',
        'views/room_office_views.xml',
        'data/ir_module_category_data.xml',
        'security/ir_rule.xml',
        'security/ir.model.access.csv',
    ],
    'demo': [
        'demo/room_office.xml',
        'demo/room_room.xml',
        'demo/room_booking.xml',
    ],
    'installable': True,
    'application': True,
    'assets': {
        'web.assets_backend': [
            'room/static/src/room_booking_gantt_view/**/*',
        ],
        'room.assets_room_booking': [
            'room/static/src/room_booking/**/*',
        ],
    },
    'license': 'OEEL-1',
}
