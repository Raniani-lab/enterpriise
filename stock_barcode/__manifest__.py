# -*- coding: utf-8 -*-

{
    'name': "Barcode",
    'summary': "Use barcode scanners to process logistics operations",
    'description': """
This module enables the barcode scanning feature for the warehouse management system.
    """,
    'category': 'Inventory/Inventory',
    'sequence': 255,
    'version': '1.0',
    'depends': ['barcodes', 'stock', 'web_tour'],
    'data': [
        'security/ir.model.access.csv',
        'views/stock_inventory_views.xml',
        'views/stock_picking_views.xml',
        'views/stock_move_line_views.xml',
        'views/stock_barcode_views.xml',
        'views/res_config_settings_views.xml',
        'views/stock_scrap_views.xml',
        'views/stock_location_views.xml',
        'wizard/stock_barcode_lot_view.xml',
        'data/data.xml',
    ],
    'demo': [
        'data/demo.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'OEEL-1',
    'assets': {
        'web.assets_backend': [
            'stock_barcode/static/src/js/stock_barcode.js',
            'stock_barcode/static/src/js/forms/picking_barcode_handler.js',
            'stock_barcode/static/src/js/forms/lot_barcode_handler.js',
            'stock_barcode/static/src/js/stock_picking_type.js',
            'stock_barcode/static/src/js/stock_picking.js',
            'stock_barcode/static/src/js/tours/running_tour_action_helper.js',
            'stock_barcode/static/src/js/tours/tour_helper_stock_barcode.js',
            'stock_barcode/static/src/js/tours/tour_test_barcode_flows.js',
            'stock_barcode/static/src/js/client_action/header_widget.js',
            'stock_barcode/static/src/js/client_action/lines_widget.js',
            'stock_barcode/static/src/js/client_action/views_widget.js',
            'stock_barcode/static/src/js/client_action/settings_widget.js',
            'stock_barcode/static/src/js/client_action/abstract_client_action.js',
            'stock_barcode/static/src/js/client_action/picking_client_action.js',
            'stock_barcode/static/src/js/client_action/inventory_client_action.js',
            'stock_barcode/static/src/scss/stock_barcode.scss',
            'stock_barcode/static/src/scss/client_action.scss',
            'stock_barcode/static/src/js/stock_barcode_kanban_record.js',
            'stock_barcode/static/src/js/stock_barcode_kanban_renderer.js',
            'stock_barcode/static/src/js/stock_barcode_kanban_view.js',
        ],
        'web.qunit_suite_tests': [
            'stock_barcode/static/tests/**/*',
        ],
        'web.assets_qweb': [
            'stock_barcode/static/src/xml/**/*',
        ],
    }
}
