# -*- coding: utf-8 -*-
{
    'name': "web_dashboard",
    'category': 'Hidden',
    'version': '1.0',
    'description':
        """
Odoo Dashboard View.
========================

This module defines the Dashboard view, a new type of reporting view. This view
can embed graph and/or pivot views, and displays aggregate values.
        """,
    'depends': ['web'],
    'license': 'OEEL-1',
    'assets': {
        'web.assets_backend': [
            'web_dashboard/static/src/js/dashboard_view.js',
            'web_dashboard/static/src/js/dashboard_renderer.js',
            'web_dashboard/static/src/js/dashboard_model.js',
            'web_dashboard/static/src/js/dashboard_controller.js',
            'web_dashboard/static/src/js/dashboard_model_extension.js',
            'web_dashboard/static/src/scss/dashboard_view.scss',
        ],
        'web.qunit_suite_tests': [
            'web_dashboard/static/tests/**/*',
        ],
        'web.assets_qweb': [
            'web_dashboard/static/src/xml/**/*',
        ],
    }
}
