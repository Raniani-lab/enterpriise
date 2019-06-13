# -*- coding: utf-8 -*-

{
    'name': 'Deferred Revenues',
    'version': '1.0',
    'depends': ['account_asset'],
    'category': 'Accounting',
    'description': """

Revenue recognitions
====================
Manage revenue recognitions on product sales.
Keeps track of the revenue recognition installments, and creates corresponding journal entries.

    """,
    'website': 'https://www.odoo.com/page/accounting',
    'category': 'Accounting',
    'data': [
        'views/account_deferred_revenue.xml',
        'views/account_deferred_expense.xml',
        'views/account_account_views.xml',
    ],
    'auto_install': True,
    'installable': True,
    'application': False,
    'license': 'OEEL-1',
}
