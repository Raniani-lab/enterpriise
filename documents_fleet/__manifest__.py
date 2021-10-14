# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Documents - Fleet',
    'version': '1.0',
    'category': 'Productivity/Documents',
    'summary': 'Fleet from documents',
    'description': """
Adds fleet data to documents
""",
    'website': ' ',
    'depends': ['documents', 'fleet'],
    'data': [
        'data/data.xml',
        'data/workflow_data.xml',
        'views/fleet_vehicle_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
}
