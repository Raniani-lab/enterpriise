# -*- coding: utf-8 -*-
{
    'name': "Grid View",

    'summary': "Basic 2D Grid view for odoo",
    'category': 'Hidden',
    'version': '0.1',
    'depends': ['web'],
    'assets': {
        'web.assets_backend': [
            'web_grid/static/src/components/grid_cell.xml',
            'web_grid/static/src/**/*',
        ],
        'web.qunit_suite_tests': [
            'web_grid/static/tests/helpers.js',
            'web_grid/static/tests/grid_cells/*',
            'web_grid/static/tests/grid_view_tests.js',
            'web_grid/static/tests/mock_server.js',
        ],
        'web.qunit_mobile_suite_tests': [
            'web_grid/static/tests/grid_view_mobile_tests.js',
        ],
    },
    'auto_install': True,
    'license': 'OEEL-1',
}
