# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ProductProduct(models.Model):
    _inherit = 'product.product'

    fsm_quantity = fields.Integer('Material Quantity', compute="_compute_fsm_quantity")

    def _compute_fsm_quantity(self):
        task_id = self.env.context.get('default_task_id')
        if task_id:
            result = self.env['product.task.map'].search_read([('product_id', 'in', self.ids), ('task_id', '=', task_id)], ['quantity', 'product_id'])
            quantities = dict(map(lambda line: (line['product_id'][0], line['quantity']), result))
            for product in self:
                product.fsm_quantity = quantities.get(product.id, 0)

    def fsm_add_quantity(self):
        task_id = self.env.context.get('default_task_id')
        if not task_id:
            return False
        line = self.env['product.task.map'].search([('task_id', '=', task_id), ('product_id', '=', self.id)], limit=1)
        if line:
            line.quantity += 1
        else:
            self.env['product.task.map'].create({
                'product_id': self.id,
                'quantity': 1,
                'task_id': task_id
            })
        return True

    def fsm_remove_quantity(self):
        task_id = self.env.context.get('default_task_id')
        if not task_id:
            return False

        line = self.env['product.task.map'].search([('task_id', '=', task_id), ('product_id', '=', self.id)], limit=1)
        if line:
            line.quantity -= 1
            if line.quantity == 0:
                line.unlink()
            return True
        return False
