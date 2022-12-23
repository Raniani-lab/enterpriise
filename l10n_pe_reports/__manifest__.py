# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Peru - Accounting Reports',
    'countries': ['pe'],
    'version': '1.0',
    'category': 'Accounting/Localizations/Reporting',
    'author': "Odoo SA",
    'description': """
        Accounting reports for Peru
    """,
    'depends': [
        'account_reports',
        'l10n_pe',
    ],
    'data': [
        "data/balance_sheet.xml",
        "data/profit_loss.xml",
    ],
    'installable': True,
    'auto_install': True,
    'website': 'https://www.odoo.com/app/accounting',
    'license': 'OEEL-1',
}
