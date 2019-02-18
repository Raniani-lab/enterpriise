# -*- coding: utf-8 -*-
{
    'name': "Field Service",
    'summary': '',
    'description': """
Field Services Management
=========================
This module adds the features needed for a modern Field service management.
It installs the following apps:
- Project
- Timesheet
- Sales

Adds the following options:
- reports on tasks
- FSM app with custom view for onsite worker
- add products on tasks
- create Sales order with timesheets and products from tasks

    """,
    'category': 'Industry',
    'version': '1.0',
    'depends': ['project_enterprise', 'sale_project_timesheet_enterprise'],
    'data': [
        'security/fsm_security.xml',
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
        'views/product_product_views.xml',
        'views/project_views.xml',
        'wizard/project_task_create_sale_order_views.xml',
    ],
    'application': True,
    'post_init_hook': 'post_install_hook_force_timer',
}
