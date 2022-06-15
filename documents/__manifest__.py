# -*- coding: utf-8 -*-
{
    'name': "Documents",

    'summary': "Document management",

    'description': """
        App to upload and manage your documents.
    """,

    'author': "Odoo",
    'category': 'Productivity/Documents',
    'sequence': 80,
    'version': '1.1',
    'application': True,
    'website': 'https://www.odoo.com/app/documents',

    # any module necessary for this one to work correctly
    'depends': ['base', 'mail', 'portal', 'web', 'attachment_indexation', 'digest'],

    # always loaded
    'data': [
        'data/ir_asset.xml',
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/digest_data.xml',
        'data/mail_data.xml',
        'data/documents_data.xml',
        'data/workflow_data.xml',
        'data/files_data.xml',
        'data/mail_template_data.xml',
        'views/assets.xml',
        'views/documents_views.xml',
        'views/templates.xml',
        'views/mail_activity_views.xml',
        'wizard/request_activity_views.xml',
        'wizard/link_to_record_views.xml',
    ],

    'demo': [
        'demo/demo.xml',
    ],
    'license': 'OEEL-1',
    'assets': {
        'mail.assets_messaging': [
            'documents/static/src/models/*.js',
        ],
        'web.assets_backend': [
            'documents/static/src/views/**/*.js',
            'documents/static/src/owl/components/pdf_manager/pdf_manager.js',
            'documents/static/src/owl/components/pdf_page/pdf_page.js',
            'documents/static/src/owl/components/pdf_group_name/pdf_group_name.js',
            'documents/static/src/js/tours/documents.js',
            'documents/static/src/scss/documents_views.scss',
            'documents/static/src/scss/documents_kanban_view.scss',
            'documents/static/src/owl/components/pdf_manager/pdf_manager.scss',
            'documents/static/src/owl/components/pdf_page/pdf_page.scss',
            'documents/static/src/owl/components/pdf_group_name/pdf_group_name.scss',
        ],
        'documents.public_page_assets': [
            ('include', 'web._assets_helpers'),
            ('include', 'web._assets_backend_helpers'),
            'web/static/src/libs/bootstrap/pre_variables.scss',
            'web/static/lib/bootstrap/scss/_variables.scss',
            ('include', 'web._assets_bootstrap'),
            'documents/static/src/scss/documents_public_pages.scss',
            'documents/static/src/js/documents_public_pages.js',
        ],
        'web.tests_assets': [
            'documents/static/tests/helpers/*',
            'documents/static/tests/legacy/helpers/*',
        ],
        'web.qunit_suite_tests': [
            'documents/static/tests/documents_test_utils.js',
            'documents/static/tests/documents_kanban_tests.js',
            'documents/static/tests/documents_pdf_manager_tests.js',
            'documents/static/tests/documents_systray_activity_menu_tests.js',
        ],
        'web.qunit_mobile_suite_tests': [
            'documents/static/tests/documents_test_utils.js',
            'documents/static/tests/documents_kanban_mobile_tests.js',
        ],
        'web.assets_qweb': [
            'documents/static/src/components/*/*.xml',
            'documents/static/src/views/**/*.xml',
            'documents/static/src/owl/components/pdf_manager/pdf_manager.xml',
            'documents/static/src/owl/components/pdf_page/pdf_page.xml',
            'documents/static/src/owl/components/pdf_group_name/pdf_group_name.xml',
        ],
    }
}
