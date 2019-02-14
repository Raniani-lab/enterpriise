# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Documents - Human Resources',
    'version': '1.0',
    'category': 'Uncategorized',
    'summary': 'Access documents from the employee profile',
    'description': """
Easily access your documents from your employee profile.
""",
    'website': ' ',
    'depends': ['documents', 'hr'],
    'data': ['views/documents_views.xml'],
    'installable': True,
    'auto_install': True,
}
