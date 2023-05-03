from odoo import models, fields, api


class PosPreparationDisplayOrder(models.Model):
    _inherit = 'pos_preparation_display.order'

    pos_table_id = fields.Many2one('restaurant.table')

    def _export_for_ui(self, preparation_display):
        order_for_ui = super()._export_for_ui(preparation_display)

        order_for_ui['table'] = {
            'id': self.pos_order_id.table_id.id,
            'seats': self.pos_order_id.table_id.seats,
            'name': self.pos_order_id.table_id.name,
            'color': self.pos_order_id.table_id.color,
        }

        return order_for_ui

    def _get_preparation_order_values(self, order):
        order_to_create = super()._get_preparation_order_values(order)

        if order.get('pos_table_id'):
            order_to_create['pos_table_id'] = order['pos_table_id']

        return order_to_create

    @api.model
    def process_order(self, order):
        super().process_order(order)

        if order.get('pos_table_id') and order['pos_order_id'] and order['pos_table_id']:
            old_orders = self.env['pos_preparation_display.order'].search([('id', '=', order['pos_order_id']), ('pos_table_id', '!=', order['pos_table_id'])])
            for o in old_orders:
                o.pos_table_id = order['pos_table_id']
