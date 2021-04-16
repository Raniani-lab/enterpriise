# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Belgian Payroll - Eco-vouchers',
    'category': 'Human Resources',
    'summary': 'Compute Eco-vouchers amount',
    'depends': ['l10n_be_hr_payroll'],
    'description': """
    """,
    'data': [
        'security/ir.model.access.csv',
        'wizard/l10n_be_eco_vouchers_wizard_views.xml',
    ],
    'qweb': [],
    'demo': [],
    'auto_install': True,
}
