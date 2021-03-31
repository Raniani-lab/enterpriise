# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Web Enterprise',
    'category': 'Hidden',
    'version': '1.0',
    'description': """
Odoo Enterprise Web Client.
===========================

This module modifies the web addon to provide Enterprise design and responsiveness.
        """,
    'depends': ['web'],
    'auto_install': True,
    'data': [
        'views/webclient_templates.xml',
    ],
    'assets': {
        'web.assets_qweb': [
            'web_enterprise/static/src/xml/*',
        ],
        'web._assets_primary_variables': [
            'web_enterprise/static/src/scss/primary_variables.scss',
        ],
        'web._assets_secondary_variables': [
            'web_enterprise/static/src/scss/secondary_variables.scss',
        ],
        'web._assets_backend_helpers': [
            ('replace', 'web/static/src/scss/bootstrap_overridden.scss', 'web_enterprise/static/src/scss/bootstrap_overridden.scss'),
        ],
        'web._assets_common_styles': [
            ('replace', 'web/static/src/scss/ui_extra.scss', 'web_enterprise/static/src/scss/ui.scss'),

            'web_enterprise/static/src/scss/fonts.scss',
        ],
        'web.assets_backend': [
            ('replace', 'web/static/src/scss/webclient_extra.scss', 'web_enterprise/static/src/scss/webclient.scss'),
            ('replace', 'web/static/src/scss/webclient_layout.scss', 'web_enterprise/static/src/scss/webclient_layout.scss'),

            ('replace', 'web/static/src/scss/dropdown_extra.scss', 'web_enterprise/static/src/scss/fields.scss'),
            ('replace', 'web/static/src/scss/fields_extra.scss', 'web_enterprise/static/src/scss/form_view.scss'),
            ('replace', 'web/static/src/scss/form_view_extra.scss', 'web_enterprise/static/src/scss/list_view.scss'),
            ('replace', 'web/static/src/scss/list_view_extra.scss', 'web_enterprise/static/src/scss/search_view.scss'),
            ('replace', 'web/static/src/scss/search_view_extra.scss', 'web_enterprise/static/src/scss/dropdown.scss'),

            'web_enterprise/static/src/scss/base_settings_mobile.scss',
            'web_enterprise/static/src/scss/home_menu.scss',
            'web_enterprise/static/src/scss/home_menu_layout.scss',
            'web_enterprise/static/src/scss/search_panel_mobile.scss',
            'web_enterprise/static/src/scss/menu_mobile.scss',
            'web_enterprise/static/src/scss/menu_search.scss',
            'web_enterprise/static/src/scss/control_panel_layout.scss',
            'web_enterprise/static/src/scss/control_panel_mobile.scss',
            'web_enterprise/static/src/scss/datepicker.scss',
            'web_enterprise/static/src/scss/kanban_view.scss',
            'web_enterprise/static/src/scss/touch_device.scss',
            'web_enterprise/static/src/scss/snackbar.scss',
            'web_enterprise/static/src/scss/swipe_item_mixin.scss',
            'web_enterprise/static/src/scss/form_view_mobile.scss',
            'web_enterprise/static/src/scss/kanban_view_mobile.scss',
            'web_enterprise/static/src/scss/modal_mobile.scss',
            'web_enterprise/static/src/scss/promote_studio.scss',
            'web_enterprise/static/src/scss/web_calendar_mobile.scss',
            'web/static/src/scss/navbar_mobile.scss',

            ('replace', 'web/static/src/js/chrome/web_client.js', 'web_enterprise/static/src/js/web_client.js'),
            ('replace', 'web/static/src/js/chrome/menu.js', 'web_enterprise/static/src/js/menu.js'),
            ('replace', 'web/static/src/js/fields/upgrade_fields.js', 'web_enterprise/static/src/js/apps.js'),

            'web_enterprise/static/src/js/home_menu_wrapper.js',
            'web_enterprise/static/src/js/home_menu.js',
            'web_enterprise/static/src/js/expiration_panel.js',
            'web_enterprise/static/src/js/menu_mobile.js',
            'web_enterprise/static/src/js/res_config_settings.js',
            'web_enterprise/static/src/js/search_panel_mobile.js',
            'web_enterprise/static/src/js/control_panel.js',
            'web_enterprise/static/src/js/swipe_item_mixin.js',
            'web_enterprise/static/src/js/core/dialog.js',
            'web_enterprise/static/src/js/views/basic/basic_renderer.js',
            'web_enterprise/static/src/js/views/calendar/calendar_controller.js',
            'web_enterprise/static/src/js/views/calendar/calendar_renderer.js',
            'web_enterprise/static/src/js/views/kanban/kanban_column.js',
            'web_enterprise/static/src/js/views/kanban/kanban_column_quick_create.js',
            'web_enterprise/static/src/js/views/kanban/kanban_renderer_mobile.js',
            'web_enterprise/static/src/js/views/kanban/kanban_tabs_mobile_mixin.js',
            'web_enterprise/static/src/js/views/kanban/kanban_view.js',
            'web_enterprise/static/src/js/views/list/list_controller.js',
            'web_enterprise/static/src/js/views/list/list_renderer_desktop.js',
            'web_enterprise/static/src/js/views/list/list_renderer_mobile.js',
            'web_enterprise/static/src/js/views/form_renderer.js',
            'web_enterprise/static/src/js/views/relational_fields.js',
            'web_enterprise/static/src/js/views/upgrade_fields.js',
            'web_enterprise/static/src/js/views/view_dialogs.js',
            'web_enterprise/static/src/js/widgets/debug_manager.js',
            'web_enterprise/static/src/js/widgets/promote_studio_dialog.js',
            'web_enterprise/static/src/js/widgets/user_menu.js',
            'web_enterprise/static/src/js/widgets/snackbar.js',
            'web_enterprise/static/src/js/widgets/switch_company_menu.js',
        ],
        'web.qunit_suite_tests': [
            ('remove', 'web/static/tests/fields/upgrade_fields_tests.js'),
            ('replace', 'web/static/tests/chrome/menu_tests.js', 'web_enterprise/static/tests/menu_tests.js'),

            'web_enterprise/static/tests/test_utils.js',
            'web_enterprise/static/tests/home_menu_tests.js',
            'web_enterprise/static/tests/expiration_panel_tests.js',
            'web_enterprise/static/tests/upgrade_fields_tests.js',
            'web_enterprise/static/tests/views/list_tests.js',
        ],
        'web.qunit_mobile_suite': [
            'web_enterprise/static/tests/test_utils.js',
            'web_enterprise/static/tests/action_manager_mobile_tests.js',
            'web_enterprise/static/tests/control_panel_mobile_tests.js',
            'web_enterprise/static/tests/mobile_company_switcher_tests.js',
            'web_enterprise/static/tests/form_tests.js',
            'web_enterprise/static/tests/mobile_menu_tests.js',
            'web_enterprise/static/tests/relational_fields_mobile_tests.js',
            'web_enterprise/static/tests/views/basic/basic_render_mobile_tests.js',
            'web_enterprise/static/tests/views/calendar_mobile_tests.js',
            'web_enterprise/static/tests/views/kanban_mobile_tests.js',
            'web_enterprise/static/tests/views/list_mobile_tests.js',
            'web_enterprise/static/tests/base_settings_mobile_tests.js',
            'web_enterprise/static/tests/components/action_menus_mobile_tests.js',
        ],
    },
    'license': 'OEEL-1',
}
