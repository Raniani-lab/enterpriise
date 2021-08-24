# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools import float_round

class SaleOrder(models.Model):
    _inherit = 'sale.order'

    # -----------------------------------------------------------------
    # Action methods
    # -----------------------------------------------------------------

    def _action_confirm(self):
        """ On SO confirmation, some lines should generate a planning slot. """
        result = super()._action_confirm()
        self.order_line.sudo()._planning_slot_generation()
        return result
