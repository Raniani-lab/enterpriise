# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'PoS Preparation Display',
    'version': '1.0.0',
    'category': 'Sales/Point of Sale',
    'sequence': 7,
    'summary': 'Display Orders for Preparation stage.',
    'depends': ['point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'security/preparation_display_security.xml',
        'views/preparation_display_assets_index.xml',
        'views/preparation_display_view.xml',
        'wizard/preparation_display_reset_wizard.xml',
    ],
    'installable': True,
    'auto_install': True,
    'post_init_hook': '_pos_preparation_display_post_init',
    'assets': {
        'pos_preparation_display.assets': [

            # 'preparation_display' bootstrap customization layer
            'web/static/src/scss/functions.scss',
            'pos_preparation_display/static/src/scss/primary_variables.scss',

            # 'webclient' bootstrap customization layer
            ('include', 'web._assets_helpers'),
            ('include', 'web._assets_backend_helpers'),

            'web/static/src/scss/pre_variables.scss',
            'web/static/lib/bootstrap/scss/_variables.scss',

            # Import Bootstrap
            ('include', 'web._assets_bootstrap_backend'),

            # Icons
            'web/static/src/libs/fontawesome/css/font-awesome.css',
            'web/static/lib/odoo_ui_icons/*',
            'web/static/src/webclient/icons.scss',

            'web/static/src/legacy/js/promise_extension.js',  # Legacy FIXME

            'web/static/src/boot.js',
            'web/static/src/env.js',
            'web/static/src/session.js',
            'web/static/src/core/utils/transitions.scss',
            'web/static/src/core/**/*',
            'web/static/lib/owl/owl.js',
            'web/static/lib/owl/odoo_module.js',
            'web/static/lib/luxon/luxon.js',

            'bus/static/src/services/bus_service.js',
            'bus/static/src/bus_parameters_service.js',
            'bus/static/src/multi_tab_service.js',
            'bus/static/src/workers/*',

            'pos_preparation_display/static/src/app/**/*',
            ('remove', 'web/static/src/core/emoji_picker/emoji_data.js'),
        ],
        'point_of_sale._assets_pos': [
            'pos_preparation_display/static/src/override/**/*.js',
        ],
        'point_of_sale.assets_qunit_tests': [
            'pos_preparation_display/static/tests/*.js',
        ],
        'web.assets_tests': [
            'pos_preparation_display/static/tests/tours/**/*',
        ],
    },
    'license': 'LGPL-3',
}
