# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Mail Mobile',
    'version': '1.0',
    'category': 'Tools',
    'summary': 'Allow push notification to devices',
    'description': """
Mail Mobile
===========

This module enables push notifications to registered devices for direct messages,
chatter messages and channel.
    """,
    'depends': [
        'iap',
        'mail_enterprise',
        'web_mobile',
        'base_setup',
    ],
    'data': [
        'views/ocn_assets.xml',
        'views/res_config_settings_views.xml',
    ],
    'installable': True,
    'auto_install': ['web_mobile', 'mail_enterprise'],
    'license': 'OEEL-1',
}
