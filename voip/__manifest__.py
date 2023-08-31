# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    "name": "VOIP",
    "summary": """
        Make calls using a VOIP system""",
    "description": """
Allows to make call from next activities or with click-to-dial.
    """,
    "category": "Productivity/VOIP",
    "sequence": 280,
    "version": "2.0",
    # any module necessary for this one to work correctly
    "depends": ["base", "mail", "web", "phone_validation", "web_mobile"],
    # always loaded
    "data": [
        "security/ir.model.access.csv",
        "views/res_config_settings_views.xml",
        "views/res_partner_views.xml",
        "views/res_users_views.xml",
        "views/res_users_settings_views.xml",
        "views/voip_phonecall_views.xml",
    ],
    "application": True,
    "license": "OEEL-1",
    "assets": {
        "voip.assets_sip": [
            "voip/static/lib/sip.js"
        ],
        "web.assets_backend": [
            "voip/static/src/**/*",
            ("remove", "voip/static/src/**/*.dark.scss"),
        ],
        "web.tests_assets": [
            "voip/static/tests/helpers/**/*.js",
        ],
        "web.dark_mode_assets_backend": [
            "voip/static/src/**/*.dark.scss",
        ],
        "web.qunit_suite_tests": [
            "voip/static/tests/**/*",
            ("remove", "voip/static/tests/helpers/**/*.js"),
        ],
    },
}
