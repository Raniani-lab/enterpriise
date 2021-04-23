# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "VOIP",

    'summary': """
        Make calls using a VOIP system""",

    'description': """
Allows to make call from next activities or with click-to-dial.
    """,

    'category': 'Productivity/VOIP',
    'sequence': 280,
    'version': '2.0',

    # any module necessary for this one to work correctly
    'depends': ['base', 'mail', 'web', 'phone_validation', 'web_mobile'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
        'views/res_partner_views.xml',
        'views/res_users_views.xml',
        'views/voip_phonecall_views.xml',
        'data/mail_activity_data.xml',
    ],
    'application': True,
    'license': 'OEEL-1',
    'assets': {
        'web.assets_backend': [
            'voip/static/lib/sip.js',
            'voip/static/src/components/activity/activity.js',
            'voip/static/src/js/call_center_field.js',
            'voip/static/src/js/dialing_panel.js',
            'voip/static/src/js/phone_call.js',
            'voip/static/src/js/phone_call_activities_tab.js',
            'voip/static/src/js/phone_call_contacts_tab.js',
            'voip/static/src/js/phone_call_details.js',
            'voip/static/src/js/phone_call_recent_tab.js',
            'voip/static/src/js/phone_call_tab.js',
            'voip/static/src/js/phone_field.js',
            'voip/static/src/js/systray_voip_menu.js',
            'voip/static/src/js/user_agent.js',
            'voip/static/src/js/web_client.js',
            'voip/static/src/models/activity/activity.js',
            'voip/static/src/scss/call_center_field.scss',
            'voip/static/src/scss/voip.scss',
        ],
        'web.qunit_suite_tests': [
            'voip/static/src/components/activity/activity_tests.js',
            'voip/static/tests/phone_widget_tests.js',
            'voip/static/tests/dialing_panel_tests.js',
        ],
        'web.assets_qweb': [
            'voip/static/src/components/activity/activity.xml',
            'voip/static/src/xml/*.xml',
        ],
    }
}
