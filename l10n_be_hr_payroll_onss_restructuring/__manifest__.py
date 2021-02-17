# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Belgian Payroll - ONSS Restructuring',
    'category': 'Human Resources',
    'summary': 'Manage ONSS Reduction for Restructuring',
    'depends': ['l10n_be_hr_payroll'],
    'description': """
    """,
    'data': [
        'views/hr_contract_views.xml',
        'data/cp200/employee_salary_data.xml',
        'data/hr_rule_parameter_data.xml',
    ],
    'qweb': [],
    'demo': [],
    'auto_install': True,
}
