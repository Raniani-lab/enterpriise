# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Mail Enterprise',
    'category': 'Productivity/Discuss',
    'depends': ['mail', 'web_mobile'],
    'description': """
Bridge module for mail and enterprise
=====================================

Display a preview of the last chatter attachment in the form view for large
screen devices.
""",
    'auto_install': True,
    'license': 'OEEL-1',
    'assets': {
        'web.assets_backend': [
            'mail_enterprise/static/src/components/chat_window/chat_window.js',
            'mail_enterprise/static/src/components/chatter_container/chatter_container.js',
            'mail_enterprise/static/src/components/dialog/dialog.js',
            'mail_enterprise/static/src/components/messaging_menu/messaging_menu.js',
            'mail_enterprise/static/src/js/attachment_viewer.js',
            'mail_enterprise/static/src/models/chatter/chatter.js',
            'mail_enterprise/static/src/widgets/form_renderer/form_renderer.js',
            'mail_enterprise/static/src/scss/mail_enterprise.scss',
            'mail_enterprise/static/src/components/chatter_container/chatter_container.scss',
            'mail_enterprise/static/src/scss/mail_enterprise_mobile.scss',
            'mail_enterprise/static/src/widgets/form_renderer/form_renderer.scss',
        ],
        'web.assets_tests': [
            'mail_enterprise/static/tests/tours/**/*',
        ],
        'web.qunit_suite_tests': [
            'mail_enterprise/static/src/components/attachment/attachment_tests.js',
            'mail_enterprise/static/src/components/chat_window_manager/chat_window_manager_tests.js',
            'mail_enterprise/static/src/components/messaging_menu/messaging_menu_tests.js',
            'mail_enterprise/static/src/widgets/form_renderer/form_renderer_tests.js',
            'mail_enterprise/static/tests/attachment_preview_tests.js',
        ],
        'web.assets_qweb': [
            'mail_enterprise/static/src/components/chatter_container/chatter_container.xml',
            'mail_enterprise/static/src/xml/mail_enterprise.xml',
        ],
    }
}
