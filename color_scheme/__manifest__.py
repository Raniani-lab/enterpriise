# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Color Scheme',
    'version': '1.0',
    'sequence': 24,
    'summary': 'Allows changing UI color schemes',
    'description': """
Color Scheme.
===========================

This module allows to changing UI color schemes.
        """,
    'depends': ['web_enterprise'],
    'auto_install': True,
    'installable': True,
    'application': True,
    'assets': {

        # ========= Dark Mode =========
        "color_scheme.dark_mode_variables": [
            # web._assets_primary_variables
            ('before', 'web_enterprise/static/src/scss/primary_variables.scss', 'color_scheme/static/src/mode_dark/primary_variables.scss'),
            ('before', 'web_enterprise/static/src/**/**/*.variables.scss', 'color_scheme/static/src/mode_dark/**/**/*.variables.scss'),
            # web._assets_secondary_variables
            ('before', 'web/static/src/scss/secondary_variables.scss', 'color_scheme/static/src/mode_dark/secondary_variables.scss'),
        ],
        "web.dark_mode_assets_common": [
            ('include', 'color_scheme.dark_mode_variables'),
        ],
        "web.dark_mode_assets_backend": [
            ('include', 'color_scheme.dark_mode_variables'),
            # web._assets_backend_helpers
            ('before', 'web_enterprise/static/src/scss/bootstrap_overridden.scss', 'color_scheme/static/src/mode_dark/bootstrap_overridden.scss'),
            ('after', 'web/static/lib/bootstrap/scss/_functions.scss', 'color_scheme/static/src/mode_dark/bs_functions_overridden.scss'),
            # assets_backend
            'color_scheme/static/src/mode_dark/**/**/*.scss',
        ],
        "web.assets_backend": [
            'color_scheme/static/src/mode_dark/js/*.js',
        ],
    },
    'license': 'OEEL-1',
}
