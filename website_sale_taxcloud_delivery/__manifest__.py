# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "TaxCloud and Delivery - Ecommerce",
    'summary': """Compute taxes with TaxCloud after online delivery computation.""",
    'description': """This module ensures that when delivery price is computed online, and taxes are computed with TaxCloud, the tax computation is done correctly on both the order and delivery.
    """,
    'category': 'Accounting/Accounting',
    'depends': ['website_sale', 'website_sale_account_taxcloud'],
    'auto_install': True,
    'license': 'OEEL-1',
    'assets': {
        'web.assets_tests': [
            'website_sale_taxcloud_delivery/static/tests/**/*',
        ],
    }
}
