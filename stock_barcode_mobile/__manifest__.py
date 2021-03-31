# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Stock Barcode in Mobile',
    'category': 'Inventory/Inventory',
    'summary': 'Stock Barcode scan in Mobile',
    'version': '1.0',
    'description': """ """,
    'depends': ['stock_barcode', 'web_mobile'],
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
    'assets': {
        'web.assets_backend': [
            'stock_barcode_mobile/static/src/js/stock_mobile_barcode.js',
            'stock_barcode_mobile/static/src/scss/stock_mobile_barcode.scss',
        ],
        'web.qunit_mobile_suite_tests': [
            'stock_barcode_mobile/static/src/tests/**/*',
        ],
        'web.assets_qweb': [
            'stock_barcode_mobile/static/src/xml/**/*',
        ],
    }
}
