# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, fields


class MrpWorkorderAdditionalProduct(models.TransientModel):
    _name = "mrp_workorder.additional.product"
    _description = "Additional Product"

    @api.model
    def default_get(self, fields):
        res = super().default_get(fields)
        workorder_id = self.env.context.get('default_workorder_id') or self.env.context.get('active_id')
        res['workorder_id'] = workorder_id
        return res

    product_id = fields.Many2one(
        'product.product',
        'Product',
        required=True,
        domain="[('company_id', 'in', (company_id, False)), ('type', '!=', 'service')]")
    product_tracking = fields.Selection(related='product_id.tracking')
    product_qty = fields.Float('Quantity', default=1, required=True)
    product_uom_id = fields.Many2one('uom.uom', domain="[('category_id', '=', product_uom_category_id)]")
    product_uom_category_id = fields.Many2one(related='product_id.uom_id.category_id')
    type = fields.Selection([
        ('component', 'Component'),
        ('byproduct', 'By-Product')])
    workorder_id = fields.Many2one('mrp.workorder', required=True)
    company_id = fields.Many2one(related='workorder_id.company_id')

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if self.product_id:
            self.product_uom_id = self.product_id.uom_id
            if self.product_tracking == 'serial':
                self.product_qty = 1

    def add_product(self):
        """Create workorder line for the additional product."""
        if self.type == 'component':
            line = {'raw_workorder_id': self.workorder_id.id}
        else:
            line = {'finished_workorder_id': self.workorder_id.id}

        line.update({
            'product_id': self.product_id.id,
            'product_uom_id': self.product_uom_id.id,
            'qty_to_consume': self.product_qty,
            'qty_reserved': self.product_qty,
            'qty_done': self.product_qty,
        })
        additional_line = self.env['mrp.workorder.line'].create(line)
        additional_line._create_additional_check()
