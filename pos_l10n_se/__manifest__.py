# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Sweden Registered Cash Register',
    'countries': ['se'],
    'version': '1.0',
    'category': 'Sales/Point Of Sale',
    'sequence': 6,
    'summary': 'Implements the registered cash system',
    'description': """

    """,
    'depends': ['pos_restaurant', 'pos_iot', 'l10n_se'],
    'data': [
        'views/pos_daily_reports.xml',
        'security/ir.model.access.csv',
        'views/pos_config.xml',
        'views/res_config_settings_views.xml',
        'views/order.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_l10n_se/static/src/**/*',
        ],
    },
    'installable': True,
    'license': 'OEEL-1',
}
