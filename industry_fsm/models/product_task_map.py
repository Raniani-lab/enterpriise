# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ProductTaskMap(models.Model):
    _name = "product.task.map"
    _description = "Product Task Map"

    task_id = fields.Many2one('project.task', required=True, ondelete='cascade')
    product_id = fields.Many2one('product.product', required=True, ondelete='cascade')
    quantity = fields.Integer('Quantity', default=1)

    _sql_constraints = [
        ('task_product_uniq', 'unique (task_id, product_id)', 'The task and product must be unique on materials ordered!'),
    ]

