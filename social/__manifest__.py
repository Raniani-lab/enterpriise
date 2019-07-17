# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Social Marketing',
    'category': 'Marketing/Social',
    'summary': 'Easily manage your social media and website visitors',
    'version': '1.0',
    'description': """Easily manage your social media and website visitors""",
    'depends': ['web', 'mail', 'iap'],
    'qweb': [
        'static/src/xml/social_templates.xml',
    ],
    'data': [
        'security/social_security.xml',
        'security/ir.model.access.csv',
        'data/ir_cron_data.xml',
        'views/assets.xml',
        'views/social_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'demo': [
        'data/social_demo.xml'
    ],
    'application': True,
    'installable': True,
}
