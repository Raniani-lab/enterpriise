from odoo import models


class PosPreparationDisplayOrder(models.Model):
    _inherit = 'pos_preparation_display.order'

    def _export_for_ui(self, preparation_display):
        order_for_ui = super()._export_for_ui(preparation_display)

        order_for_ui['table'] = {
            'id': self.pos_order_id.table_id.id,
            'seats': self.pos_order_id.table_id.seats,
            'name': self.pos_order_id.table_id.name,
            'color': self.pos_order_id.table_id.color,
        }

        return order_for_ui
