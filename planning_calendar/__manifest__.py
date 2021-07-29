# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "planning_calendar",
    'summary': """Integration between Planning and Calendar""",
    'description': """
        Automatically create slots for calendar events.
    """,
    'category': 'Human Resources/Planning',
    'version': '1.0',
    'depends': ['planning', 'calendar'],
    'auto_install': True,
    'data': [
        'data/planning_calendar_data.xml',
        'views/calendar_event_views.xml',
        'views/planning_slot_views.xml',
    ],
    'license': 'OEEL-1',
}
