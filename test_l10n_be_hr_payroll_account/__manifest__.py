# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Test Belgian Payroll',
    'category': 'Human Resource',
    'summary': 'Test Belgian Payroll',
    'depends': [
        'hr_contract_salary',
        'l10n_be_hr_payroll_account',
        'l10n_generic_coa',
        'l10n_be',
        'account_accountant',
    ],
    'description': """
    """,
    'data': [],
    'qweb': [],
    'demo': ['data/test_l10n_be_hr_payroll_account_demo.xml'],
    'auto_install': True,
}
