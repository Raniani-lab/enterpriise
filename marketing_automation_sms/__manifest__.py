# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Mass SMS in Marketing Automation",
    'version': "1.0",
    'summary': "Integrate mass SMS in marketing campaigns",
    'category': "Marketing/Marketing Automation",
    'depends': [
        'marketing_automation',
        'mass_mailing_sms'
    ],
    'data': [
        'views/mailing_mailing_views.xml',
        'views/marketing_activity_views.xml',
        'views/marketing_campaign_views.xml',
    ],
    'demo': [
    ],
    'auto_install': True,
}
