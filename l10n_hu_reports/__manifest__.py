# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Hungary - Accounting Reports',
    'icon': '/l10n_hu/static/description/icon.png',
    'version': '1.0',
    'category': 'Accounting/Localizations/Reporting',
    'description': """ Base module for Hungary reports """,
    'depends': [
        'l10n_hu',
        'account_reports',
    ],
    'data': [
        'data/balance_sheet.xml',
        'data/profit_loss.xml',
        'data/account_report_ec_sales_list_report.xml',
    ],
    'auto_install': True,
    'installable': True,
    'license': 'OEEL-1',
}
