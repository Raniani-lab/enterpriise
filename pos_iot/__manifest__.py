# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': '',
    'version': '1.0',
    'category': 'Sales/Point of Sale',
    'sequence': 6,
    'summary': 'Link your PoS configuration with an IoT Box',
    'description': """
It links the module
""",
    'data': [
        'views/pos_config_views.xml',
        'views/point_of_sale_assets.xml',
        'views/res_config_setting_views.xml',
        'views/pos_payment_method_views.xml',
    ],
    'depends': ['point_of_sale', 'iot'],
    'qweb': [
        'static/src/xml/IoTErrorPopup.xml',
        'static/src/xml/ScaleScreen.xml',
    ],
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
}
