# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Mexican Localization for the Point of Sale',
    'version': '0.1',
    'category': 'Accounting/Localizations/EDI',
    'description': """
    """,
    'depends': [
        'l10n_mx_edi',
        'point_of_sale',
    ],
    'data': [
        'views/pos_payment_method_views.xml',
    ],
    'assets': {
        'point_of_sale.assets': [
            'l10n_mx_edi_pos/static/src/**/*.js',
            'l10n_mx_edi_pos/static/src/**/*.xml',
            'l10n_mx_edi_pos/static/src/**/*.scss',
            'l10n_mx_edi_pos/static/src/*.js',
        ],
        'web.assets_tests': [
            'l10n_mx_edi_pos/static/tests/tours/tour_invoice_order.js',
            'l10n_mx_edi_pos/static/tests/tours/tour_invoice_previous_order.js',
        ],
    },
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
}
