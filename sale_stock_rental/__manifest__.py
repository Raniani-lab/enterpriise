# -*- coding: utf-8 -*-
{
    'name': "Rental Stock Management",

    'summary': """
        Allow use of stock application to manage rentals inventory
        """,

    'description': """

    """,

    'author': "Odoo S.A.",
    'website': "https://www.odoo.com",

    'category': 'Sales',
    'version': '1.0',

    'depends': ['sale_renting', 'stock'],

    'data': [
        'wizard/rental_configurator_views.xml',
        'wizard/rental_processing_views.xml',
        'report/rental_schedule_views.xml',
        'views/sale_views.xml',
        'views/assets.xml',
    ],
    'demo': [
        'data/rental_stock_demo.xml',
    ],
    'auto_install': True,
    'post_init_hook': '_ensure_rental_stock_moves_consistency'
}
