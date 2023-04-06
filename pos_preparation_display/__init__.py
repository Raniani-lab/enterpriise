from . import controllers
from . import models
from . import wizard
from odoo.tools import convert

def _pos_preparation_display_post_init(env):
    if env.ref('point_of_sale.pos_config_main', raise_if_not_found=False) and not env.ref('pos_preparation_display.preparation_display_main_shop', raise_if_not_found=False):
        convert.convert_file(env, 'pos_preparation_display',
                             'data/main_shop_preparation_display_data.xml', None, mode='init', kind='data')
