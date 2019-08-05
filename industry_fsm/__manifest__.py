# -*- coding: utf-8 -*-
{
    'name': "Field Service",
    'summary': "Schedule and track onsite operations, invoice time and material",
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
    'depends': ['project_enterprise', 'sale_timesheet_enterprise'],
    'data': [
        'data/fsm_data.xml',
        'security/fsm_security.xml',
        'views/res_config_settings_views.xml',
        'views/product_product_views.xml',
        'views/project_views.xml',
        'views/assets.xml',
    ],
    'application': True,
    'demo': ['data/fsm_demo.xml'],
}
