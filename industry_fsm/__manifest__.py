# -*- coding: utf-8 -*-
{
    'name': "Field Service",
    'summary': 'Plan your Onsite interventions',
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
    'category': 'Industry/Field Service',
    'version': '1.0',
    'depends': ['project_enterprise', 'sale_project_timesheet_enterprise'],
    'data': [
        'data/fsm_data.xml',
        'security/fsm_security.xml',
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
        'views/product_product_views.xml',
        'views/project_views.xml',
        'views/assets.xml',
    ],
    'application': True,
    'demo': ['data/fsm_demo.xml'],
    'post_init_hook': 'post_install_hook_force_timer',
}
