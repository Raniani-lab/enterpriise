# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ProductProduct(models.Model):
    _inherit = 'product.product'

    fsm_quantity = fields.Integer('Material Quantity', compute="_compute_fsm_quantity")

    def _compute_fsm_quantity(self):
        task_id = self.env.context.get('fsm_task_id')
        if task_id:
            task = self.env['project.task'].browse(task_id)
            product_map = {sol.product_id.id: sol.product_uom_qty for sol in task.sudo().sale_order_id.order_line}

            for product in self:
                product.fsm_quantity = product_map.get(product.id, 0)
        else:
            self.fsm_quantity = False

    def fsm_add_quantity(self):
        task_id = self.env.context.get('fsm_task_id')
        if task_id:
            task = self.env['project.task'].browse(task_id)

            SaleOrderLine = self.env['sale.order.line']
            if self.user_has_groups('project.group_project_user'):
                task = task.sudo()
                SaleOrderLine = SaleOrderLine.sudo()

            sale_line = SaleOrderLine.search([('order_id', '=', task.sale_order_id.id), ('product_id', '=', self.id)], limit=1)

            if not sale_line:  # create the sale line with qty = 1
                vals = {
                    'order_id': task.sale_order_id.id,
                    'product_id': self.id,
                    'product_uom_qty': 1,
                    'product_uom': self.uom_id.id,
                }

                # Note: force to False to avoid changing planned hours when modifying product_uom_qty on SOL
                # for materials. Set the current task for service to avoid re-creating a task on SO cnofirmation.
                if self.type == 'service':
                    vals['task_id'] = task_id
                else:
                    vals['task_id'] = False

                if self.invoice_policy == 'delivery' and self.service_type == 'manual':
                    vals['qty_delivered'] = 1
                sale_line = SaleOrderLine.create(vals)
            else:   # increment sale line quantities
                vals = {
                    'product_uom_qty': sale_line.product_uom_qty + 1
                }
                if self.invoice_policy == 'delivery' and self.service_type == 'manual':
                    vals['qty_delivered'] = sale_line.qty_delivered + 1
                sale_line.write(vals)
        return True

    def fsm_remove_quantity(self):
        task_id = self.env.context.get('fsm_task_id')
        if task_id:
            task = self.env['project.task'].browse(task_id)

            SaleOrderLine = self.env['sale.order.line']
            if self.user_has_groups('project.group_project_user'):
                task = task.sudo()
                SaleOrderLine = SaleOrderLine.sudo()

            sale_line = SaleOrderLine.search([('order_id', '=', task.sale_order_id.id), ('product_id', '=', self.id)], limit=1)
            if sale_line:
                vals = {
                    'product_uom_qty': sale_line.product_uom_qty - 1
                }
                if self.invoice_policy == 'delivery' and self.service_type == 'manual':
                    vals['qty_delivered'] = sale_line.qty_delivered - 1

                if vals['product_uom_qty'] and task.sale_order.state != 'sale' <= 0:
                    sale_line.unlink()
                else:
                    sale_line.write(vals)

        return True
