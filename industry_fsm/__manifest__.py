# -*- coding: utf-8 -*-
{
    'name': "Field Service",
    'summary': '',
    'description': """
Field Services Management
=========================

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
