# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Sale Project Timesheet Enterprise',
    'category': 'Hidden',
    'summary': 'Create Sales Order from Tasks',
    'description': """
Create a Sales Order from a Task
================================

This module allows you to create a sales order directly from timesheets within a task.
It will calculate the total time spent on the task at the product rate.
""",
    'depends': ['sale_timesheet_enterprise'],
    'data': [
        'wizard/project_task_create_sale_order_views.xml',
        'views/project_task_views.xml',
    ],
}
