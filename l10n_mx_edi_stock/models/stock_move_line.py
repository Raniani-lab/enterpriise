# -*- coding: utf-8 -*-

from odoo import models

class StockMoveLine(models.Model):
    _inherit = 'stock.move.line'

    def _get_aggregated_product_quantities(self, **kwargs):
        """Include weight in the dict of aggregated products moved

        returns: dictionary {same_key_as_super: {same_values_as_super, weight: weight}, ...}
        """
        aggregated_move_lines = super()._get_aggregated_product_quantities(**kwargs)
        if self.picking_id.l10n_mx_edi_status == 'sent':
            for v in aggregated_move_lines.values():
                v['weight'] = v['product_uom']._compute_quantity(v['qty_done'], v['product'].uom_id) * v['product'].weight
        return aggregated_move_lines
