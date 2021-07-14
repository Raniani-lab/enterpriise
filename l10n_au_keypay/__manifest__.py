# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Keypay Australian Payroll',
    'icon': '/l10n_au/static/description/icon.png',
    'category': 'Accounting',
    'depends': [
        'l10n_au',
        'account_accountant',
    ],
    'version': '1.0',
    'description': """
        KeyPay Payroll Integration
        This Module will synchronise all payrun journals from KeyPay to Odoo.
    """,
    'author': 'Odoo S.A.,Inspired Software Pty Limited',
    'contributors': [
        'Michael Villamar',
        'Jacob Oldfield',
    ],
    'website': 'http://www.inspiredsoftware.com.au',
    'data': [
        'data/ir_cron_data.xml',
        'views/account_views.xml',
        'views/res_config_settings.xml',
    ],
    'installable': True,
    'license': 'OEEL-1',
}
