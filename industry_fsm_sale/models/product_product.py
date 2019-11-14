# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from collections import defaultdict

from odoo import api, fields, models


class ProductProduct(models.Model):
    _inherit = 'product.product'

    fsm_quantity = fields.Integer('Material Quantity', compute="_compute_fsm_quantity")

    @api.depends_context('fsm_task_id')
    def _compute_fsm_quantity(self):
        task_id = self.env.context.get('fsm_task_id')
        if task_id:
            task = self.env['project.task'].browse(task_id)
            products_qties = self.env['sale.order.line'].read_group(
                [('id', 'in', task.sale_order_id.order_line.ids)],
                ['product_id', 'product_uom_qty'], ['product_id'])
            qty_dict = dict([(x['product_id'][0], x['product_uom_qty']) for x in products_qties])
            for product in self:
                product.fsm_quantity = qty_dict.get(product.id, 0)
        else:
            self.fsm_quantity = False

    # Is override by fsm_stock to manage lot
    def action_assign_serial(self):
        return False

    def fsm_add_quantity(self):
        task_id = self.env.context.get('fsm_task_id')
        if task_id:
            task = self.env['project.task'].browse(task_id)

            # don't add material on confirmed SO to avoid inconsistence with the stock picking
            if task.fsm_done:
                return False

            # create a sale order
            task._fsm_ensure_sale_order()

            wizard_product_lot = self.action_assign_serial()
            if wizard_product_lot:
                return wizard_product_lot

            # project user with no sale rights should be able to add materials
            SaleOrderLine = self.env['sale.order.line']
            if self.user_has_groups('project.group_project_user'):
                task = task.sudo()
                SaleOrderLine = SaleOrderLine.sudo()

            sale_line = SaleOrderLine.search([('order_id', '=', task.sale_order_id.id), ('product_id', '=', self.id), '|', ('qty_delivered', '=', 0), ('qty_delivered_method', '=', 'manual')], limit=1)

            if sale_line:  # existing line: increment ordered qty (and delivered, if delivered method)
                vals = {
                    'product_uom_qty': sale_line.product_uom_qty + 1
                }
                if sale_line.qty_delivered_method == 'manual':
                    vals['qty_delivered'] = sale_line.qty_delivered + 1
                sale_line.with_context(fsm_no_message_post=True).write(vals)
            else:  # create new SOL
                vals = {
                    'order_id': task.sale_order_id.id,
                    'product_id': self.id,
                    'product_uom_qty': 1,
                    'product_uom': self.uom_id.id,
                }
                if self.service_type == 'manual':
                    vals['qty_delivered'] = 1

                # Note: force to False to avoid changing planned hours when modifying product_uom_qty on SOL
                # for materials. Set the current task for service to avoid re-creating a task on SO cnofirmation.
                if self.type == 'service':
                    vals['task_id'] = task_id
                else:
                    vals['task_id'] = False

                sale_line = SaleOrderLine.create(vals)

        return True

    def fsm_remove_quantity(self):
        task_id = self.env.context.get('fsm_task_id')
        if task_id:
            task = self.env['project.task'].browse(task_id)

            # don't remove material on confirmed SO to avoid inconsistence with the stock picking
            if task.fsm_done:
                return False

            wizard_product_lot = self.action_assign_serial()
            if wizard_product_lot:
                return wizard_product_lot

            SaleOrderLine = self.env['sale.order.line']
            # project user with no sale rights should be able to remove materials
            if self.user_has_groups('project.group_project_user'):
                task = task.sudo()
                SaleOrderLine = SaleOrderLine.sudo()

            sale_line = SaleOrderLine.search([('order_id', '=', task.sale_order_id.id), ('product_id', '=', self.id), ('product_uom_qty', '>=', 1)], limit=1)
            if sale_line:
                vals = {
                    'product_uom_qty': sale_line.product_uom_qty - 1
                }
                if sale_line.qty_delivered_method == 'manual':
                    vals['qty_delivered'] = sale_line.qty_delivered - 1

                if vals['product_uom_qty'] <= 0 and task.sale_order_id.state != 'sale':
                    sale_line.unlink()
                else:
                    sale_line.with_context(fsm_no_message_post=True).write(vals)

        return True
