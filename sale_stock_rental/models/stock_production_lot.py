# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class ProductionLot(models.Model):
    _inherit = 'stock.production.lot'

    @api.multi
    def _get_available_rental_qty(self, warehouse=None):
        """
        :param stock.warehouse warehouse: warehouse where the quantity has to be searched.
        """
        if warehouse:
            def fun(quant):
                return (
                    quant.location_id.get_warehouse() == warehouse
                    and quant.location_id.is_rental_location()
                )
        else:
            def fun(quant):
                return quant.location_id.is_rental_location()

        return sum(self.mapped('quant_ids').filtered(fun).mapped('quantity'))
