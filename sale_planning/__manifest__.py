# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Sale Planning',
    'category': 'Hidden',
    'description': """
        Bridge module between sale and planning.
    """,
    'depends': ['sale_management', 'planning'],
    'data': [
        'views/planning_role_views.xml',
        'views/product_views.xml',
    ],
    'demo': [
        'data/product_demo.xml',
    ],
    'auto_install': True,
    'license': 'OEEL-1',
}
