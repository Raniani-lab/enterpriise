# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Helpdesk Account',
    'category': 'Helpdesk',
    'summary': 'Project, Tasks, Account',
    'depends': ['helpdesk_sale', 'account'],
    'auto_install': False,
    'description': """
        Create Credit Notes from Helpdesk's tickets
    """,
    'data': [
        'wizard/account_invoice_refund_views.xml',
        'views/helpdesk_views.xml',
    ],
}
