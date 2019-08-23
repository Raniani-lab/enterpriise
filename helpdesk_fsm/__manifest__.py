# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details
{
    'name': "Helpdesk FSM",
    'summary': "Allow generating fsm tasks from ticket",
    'description': """
        Convert helpdesk tickets to field service tasks.
    """,
    'depends': ['helpdesk', 'industry_fsm'],
    'data': [
        'views/helpdesk_views.xml',
        'views/project_task_views.xml',
        'wizard/create_task_views.xml',
    ],
    'auto_install': True,
}