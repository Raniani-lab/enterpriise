# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models


class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    def _get_check_values(self, quality_point):
        vals = super(StockMoveLine, self)._get_check_values(quality_point)
        vals.update({'production_id': self.move_id.production_id.id or self.move_id.raw_material_production_id.id})
        return vals

    def _create_quality_check_at_write(self, vals):
        if self.move_id.production_id or self.move_id.raw_material_production_id:
            return False
        return super()._filter_move_lines_applicable_for_quality_check()

    def _filter_move_lines_applicable_for_quality_check(self):
        if self.move_id.production_id or self.move_id.raw_material_production_id:
            return self
        else:
            return super()._filter_move_lines_applicable_for_quality_check()
