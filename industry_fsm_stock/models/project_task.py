# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class Task(models.Model):
    _inherit = "project.task"

    def _fsm_create_sale_order(self):
        sale_order = super(Task, self)._fsm_create_sale_order()
        self.sudo()._validate_stock()
        return sale_order

    def _validate_stock(self):
        for picking in self.sale_order_id.picking_ids:
            for move in picking.move_lines:
                for move_line in move.move_line_ids:
                    move_line.qty_done = move_line.product_uom_qty

        # context key used to keep track of the backorder so it can be manually treated later
        self.sale_order_id.picking_ids.with_context({'cancel_backorder': False}).action_done()
