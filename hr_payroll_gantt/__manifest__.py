# -*- coding: utf-8 -*-
{
    'name': "Payroll Gantt",
    'summary': """Gantt view for hr payroll""",
    'description': """
     Gantt view for hr payroll
    """,
    'category': 'Human Resources',
    'version': '1.0',
    'depends': ['hr_payroll', 'web_gantt'],
    'data': [
        'views/hr_payroll_gantt_view.xml',
        'views/hr_payroll_gantt_templates.xml',
    ],
    'auto_install': True,
}
