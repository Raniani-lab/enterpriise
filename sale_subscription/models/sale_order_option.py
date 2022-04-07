# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class SaleOrderOption(models.Model):
    _name = "sale.order.option"
    _inherit = ['sale.order.option']

    option_pricing_ids = fields.One2many(related='product_id.product_pricing_ids')
    option_pricelist_id = fields.Many2one(related='order_id.pricelist_id')
    option_pricing_id = fields.Many2one('product.pricing', domain="[('id', 'in', option_pricing_ids), '|', ('pricelist_id', '=', False), ('pricelist_id', '=', option_pricelist_id)]")

    def _get_values_to_add_to_order(self):
        self.ensure_one()
        values = super()._get_values_to_add_to_order()
        values['pricing_id'] = self.option_pricing_id.id
        return values

    @api.depends('option_pricing_id')
    def _compute_is_present(self):
        super()._compute_is_present()
        for option in self:
            if not option.option_pricing_id:
                continue
            option.is_present = any(line.product_id == option.product_id and line.pricing_id.id == option.option_pricing_id.id for line in option.order_id.order_line)
