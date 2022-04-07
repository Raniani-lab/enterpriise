# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tools import format_amount
from odoo import fields, models, _

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    product_pricing_ids = fields.One2many('product.pricing', 'product_template_id', string="Custom Pricings", auto_join=True, copy=True)
    is_temporal = fields.Boolean(compute='_compute_is_temporal')
    display_price = fields.Char("Leasing price", help="First leasing pricing of the product", compute="_compute_display_price")

    def _compute_is_temporal(self):
        self.is_temporal = False

    def _compute_display_price(self):
        temporal_products = self.filtered('is_temporal')
        temporal_priced_products = temporal_products.filtered('product_pricing_ids')
        (self - temporal_products).display_price = ""
        for product in (temporal_products - temporal_priced_products):
            product.display_price = _("%(amount)s (fixed)", amount=format_amount(self.env, product.list_price, product.currency_id))
        # No temporal pricing defined, fallback on list price
        for product in temporal_priced_products:
            product.display_price = product.product_pricing_ids[0].description
