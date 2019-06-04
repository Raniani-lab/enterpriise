# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Forecast",
    'summary': """Forecast your resources on project tasks""",
    'description': """
    Schedule your teams across projects and estimate deadlines more accurately.
    """,
    'category': 'Project',
    'version': '1.0',
    'depends': ['project', 'web_grid', 'hr', 'web_gantt'],
    'data': [
        'security/ir.model.access.csv',
        'security/project_forecast_security.xml',
        'views/project_forecast_views.xml',
        'views/assets.xml',
        'views/project_views.xml',
        'views/res_config_settings_views.xml',
        'data/project_forecast_data.xml',
        'data/project_forecast_cron.xml',
        'data/mail_data.xml',
        'wizard/repeat_views.xml',
        'wizard/create_views.xml',
    ],
    'demo': [
        'data/project_forecast_demo.xml',
    ],
    'application': True,
    'license': 'OEEL-1',
    'qweb': [
        'static/src/xml/project_forecast_template.xml',
    ]
}
