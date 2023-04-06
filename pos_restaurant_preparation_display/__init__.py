from . import models
from odoo.tools import convert

def _pos_restaurant_preparation_display_post_init(env):
    if env.ref('pos_restaurant.pos_config_main_restaurant', raise_if_not_found=False) and not env.ref('pos_preparation_display.preparation_display_main_restaurant', raise_if_not_found=False):
        convert.convert_file(env, 'pos_restaurant_preparation_display',
                             'data/main_restaurant_preparation_display_data.xml', None, mode='init', kind='data')
