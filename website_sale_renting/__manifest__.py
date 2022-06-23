{
    'name': 'eCommerce Rental',
    'category': 'Hidden',
    'summary': 'Sell rental products on your eCommerce',
    'version': '1.0',
    'description': """
This module allows you to sell rental products in your eCommerce with
appropriate views and selling choices.
    """,
    'depends': ['website_sale', 'sale_renting'],
    'data': [
        'security/ir.model.access.csv',
        'security/website_sale.xml',
        'data/product_snippet_template_data.xml',
        'views/product_views.xml',
        'views/res_config_settings_views.xml',
        'views/templates.xml',
    ],
    'demo': [
        'data/demo.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'website_sale_renting/static/src/scss/*.scss',
            'website_sale_renting/static/src/js/*.js',
        ],
        'web.assets_tests': [
            'website_sale_renting/static/tests/tours/**/*',
        ],
    },
    'auto_install': True,
    'license': 'OEEL-1',
}
