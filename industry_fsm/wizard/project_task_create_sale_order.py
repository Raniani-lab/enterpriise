# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ProjectTaskCreateSalesOrder(models.TransientModel):
    _inherit = 'project.task.create.sale.order'

    material_line_ids = fields.One2many(related='task_id.material_line_ids')
    product_template_ids = fields.Many2many(related='task_id.product_template_ids')

    def _prepare_sale_order(self):
        """ Override to add material to sale order
        """
        sale_order = super(ProjectTaskCreateSalesOrder, self)._prepare_sale_order()
        for line in self.material_line_ids:
            self.env['sale.order.line'].create({
                'order_id': sale_order.id,
                'product_id': line.product_id.id,
                'product_uom_qty': line.quantity
                })
        return sale_order
