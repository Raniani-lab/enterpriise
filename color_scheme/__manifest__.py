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
        'web._assets_primary_variables': [
            ('before', 'web_enterprise/static/src/legacy/scss/primary_variables.scss', 'color_scheme/static/src/mode_dark/primary_variables.scss'),
            ('before', 'web_enterprise/static/src/**/**/*.variables.scss', 'color_scheme/static/src/mode_dark/**/**/*.variables.scss'),
        ],
        'web._assets_secondary_variables': [
            ('before', 'web/static/src/legacy/scss/secondary_variables.scss', 'color_scheme/static/src/mode_dark/secondary_variables.scss')
        ],

        'web._assets_backend_helpers': [
            ('before', 'web_enterprise/static/src/legacy/scss/bootstrap_overridden.scss', 'color_scheme/static/src/mode_dark/bootstrap_overridden.scss'),
            'color_scheme/static/src/mode_dark/bs_functions_overridden.scss'
        ],

        "web.assets_backend": [
            'color_scheme/static/src/mode_dark/**/**/*.scss',
            'color_scheme/static/src/mode_dark/js/*.js',
        ],
    },
    'license': 'OEEL-1',
}
