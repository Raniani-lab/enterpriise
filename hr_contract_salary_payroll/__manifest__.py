# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'HR Contract Salary - Payroll',
    'category': 'Human Resources',
    'summary': 'Gross to Net Salary Simulaton',
    'depends': [
        'hr_contract_salary',
        'hr_payroll',
    ],
    'description': """
    """,
    'data': [
        'data/hr_contract_salary_resume_data.xml',
        'views/assets.xml',
        'views/menuitems.xml',
    ],
    'demo': [
    ],
    'license': 'OEEL-1',
    'auto_install': True,
}
