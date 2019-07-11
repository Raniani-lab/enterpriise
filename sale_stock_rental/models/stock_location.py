# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class StockLocation(models.Model):
    _inherit = 'stock.location'

    def is_rental_location(self):
        self.ensure_one()
        if not self.usage == 'internal':
            return False
        wh = self.get_warehouse()
        return wh and (wh.lot_stock_id == self or self.is_child_of(wh.lot_stock_id))

    def is_child_of(self, location):
        """Check whether location contains or is self.

        :param stock.location location:
        :return: true if self is location or in location.childs, false otherwise
        :rtype: bool
        """
        childs = self.search([('id', 'child_of', location.id)])
        childs += location
        return all(loc in childs for loc in self)
