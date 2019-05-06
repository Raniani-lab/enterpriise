# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Documents - HR',
    'version': '1.0',
    'category': 'Uncategorized',
    'summary': 'HR from documents',
    'description': """
Add the ability to manage hr files through documents.
""",
    'website': ' ',
    'depends': ['documents', 'hr'],
    'data': ['data/documents_hr_data.xml', 'views/documents_views.xml'],
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
}
