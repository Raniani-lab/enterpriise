# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Approvals',
    'version': '1.0',
    'category': 'Human Resources/Approvals',
    'sequence': 190,
    'summary': 'Create and validate approvals requests',
    'description': """
This module manages approvals workflow
======================================

This module manages approval requests like business trips,
out of office, overtime, borrow items, general approvals,
procurements, contract approval, etc.

According to the approval type configuration, a request
creates next activities for the related approvers.
    """,
    'depends': ['mail', 'hr', 'product'],
    'data': [
        'security/approval_security.xml',
        'security/ir.model.access.csv',

        'data/approval_category_data.xml',
        'data/mail_activity_data.xml',

        'views/approval_category_views.xml',
        'views/approval_product_line_views.xml',
        'views/approval_request_views.xml',
        'views/res_users_views.xml',
    ],
    'demo':[
        'data/approval_demo.xml',
    ],
    'application': True,
    'installable': True,
    'auto_install': False,
    'assets': {
        'web.assets_backend': [
            'approvals/static/src/bugfix/bugfix.js',
            'approvals/static/src/components/activity/activity.js',
            'approvals/static/src/components/approval/approval.js',
            'approvals/static/src/models/activity/activity.js',
            'approvals/static/src/models/approval/approval.js',
            'approvals/static/src/widgets/form_renderer/form_renderer.js',
            'approvals/static/src/bugfix/bugfix.scss',
            'approvals/static/src/components/approval/approval.scss',
        ],
        'web.assets_tests': [
            'approvals/static/tests/tours/**/*',
        ],
        'web.tests_assets': [
            'approvals/static/tests/helpers/**/*',
        ],
        'web.qunit_suite_tests': [
            'approvals/static/src/bugfix/bugfix_tests.js',
            'approvals/static/src/components/activity/activity_tests.js',
        ],
        'web.assets_qweb': [
            'approvals/static/src/bugfix/bugfix.xml',
            'approvals/static/src/components/activity/activity.xml',
            'approvals/static/src/components/approval/approval.xml',
            'approvals/static/src/xml/*.xml',
        ],
    }
}
