# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Knowledge',
    'summary': 'Centralize, manage, share and grow your knowledge library',
    'description': 'Centralize, manage, share and grow your knowledge library',
    'category': 'Productivity/Knowledge',
    'version': '1.0',
    'depends': [
        'web',
        'web_editor',
        'mail',
        'portal',
        'web_unsplash'
    ],
    'data': [
        'data/article_templates.xml',
        'data/ir_config_parameter_data.xml',
        'data/behaviors_templates.xml',
        'data/knowledge_article_template_category_data.xml',
        'data/knowledge_article_template_data.xml',
        'data/ir_actions_data.xml',
        'data/mail_templates.xml',
        'wizard/knowledge_invite_views.xml',
        'views/knowledge_article_views.xml',
        'views/knowledge_article_favorite_views.xml',
        'views/knowledge_article_member_views.xml',
        'views/knowledge_article_stage_views.xml',
        'views/knowledge_article_template_views.xml',
        'views/knowledge_article_template_category_views.xml',
        'views/knowledge_templates_frontend.xml',
        'views/knowledge_templates_portal.xml',
        'views/knowledge_menus.xml',
        'views/portal_templates.xml',
        'security/ir.model.access.csv',
        'security/ir_rule.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'OEEL-1',
    'pre_init_hook': 'pre_init_knowledge',
    'post_init_hook': '_init_private_article_per_user',
    'assets': {
        'web.assets_backend': [
            'knowledge/static/src/scss/knowledge_common.scss',
            'knowledge/static/src/scss/knowledge_views.scss',
            'knowledge/static/src/scss/knowledge_editor.scss',
            'knowledge/static/src/scss/knowledge_blocks.scss',
            'knowledge/static/src/xml/**/*',
            'knowledge/static/src/components/**/*',
            'knowledge/static/src/emoji_picker/**/*',
            'knowledge/static/src/search_model/**/*',
            'knowledge/static/src/web/**/*',
            'knowledge/static/src/js/sortableList.js',
            'knowledge/static/src/js/knowledge_controller.js',
            'knowledge/static/src/js/knowledge_utils.js',
            'knowledge/static/src/js/knowledge_renderers.js',
            'knowledge/static/src/js/knowledge_views.js',
            'knowledge/static/src/webclient/**/*',
            'knowledge/static/src/views/**/*',
            'knowledge/static/src/services/**/*',
            'knowledge/static/src/macros/**/*',
            ('remove', 'knowledge/static/src/xml/knowledge_frontend.xml'),
        ],
        "web.dark_mode_assets_backend": [
            'knowledge/static/src/scss/knowledge_views.dark.scss',
        ],
        'web.assets_frontend': [
            'knowledge/static/src/scss/knowledge_common.scss',
            'knowledge/static/src/scss/knowledge_frontend.scss',
            'knowledge/static/src/scss/knowledge_blocks.scss',
            'knowledge/static/src/js/tools/**/*',
            'knowledge/static/src/js/knowledge_frontend.js',
            'knowledge/static/src/xml/knowledge_frontend.xml',
        ],
        'web.assets_common': [
            'knowledge/static/src/js/tools/**/*',
        ],
        'web_editor.assets_wysiwyg': [
            'knowledge/static/src/js/wysiwyg.js',
            'knowledge/static/src/js/knowledge_wysiwyg.js',
            'knowledge/static/src/xml/knowledge_editor.xml',
            'knowledge/static/src/xml/knowledge_article_templates.xml',
            'knowledge/static/src/js/knowledge_clipboard_whitelist.js',
        ],
        'web.assets_tests': [
            'knowledge/static/tests/tours/**/*',
        ],
        'web.qunit_suite_tests': [
            'knowledge/static/tests/knowledge_form_view_tests.js',
            'knowledge/static/tests/form_controller_patch_tests.js',
            'knowledge/static/tests/knowledge_external_embeds_hotkeys.js',
            'knowledge/static/tests/knowledge_form_view_tests.js'
        ],
        'web.tests_assets': [
            'knowledge/static/tests/mock_services.js',
        ],
        'knowledge.webclient': [
            ('include', 'web.assets_backend'),
            # knowledge webclient overrides
            'knowledge/static/src/portal_webclient/**/*',
            'web/static/src/start.js',
            'web/static/src/legacy/legacy_setup.js',
        ],
        'knowledge.assets_knowledge_print': [
            'knowledge/static/src/scss/knowledge_print.scss',
        ]
    },
}
