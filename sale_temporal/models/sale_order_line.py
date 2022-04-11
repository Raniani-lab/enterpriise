# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import fields, models, api


_logger = logging.getLogger(__name__)

INTERVAL_FACTOR = {
    'daily': 30.0,
    'weekly': 30.0 / 7.0,
    'monthly': 1.0,
    'yearly': 1.0 / 12.0,
}


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    start_date = fields.Datetime(string='Start Date', compute='_compute_start_date', readonly=False, store=True, precompute=True)
    next_invoice_date = fields.Datetime(compute='_compute_next_invoice_date', readonly=False, store=True, precompute=True,
                                        help="The next invoice will be created on this date then the period will be extended.")
    pricelist_id = fields.Many2one(related='order_id.pricelist_id')
    pricing_id = fields.Many2one('product.pricing',
                                 domain="[('id', 'in', product_pricing_ids),"
                                        "'|',"
                                        "('product_variant_ids', '=', False),"
                                        "('product_variant_ids', '=', product_id),"
                                        "'|',"
                                        "('pricelist_id', '=', False),"
                                        "('pricelist_id', '=', pricelist_id)]",
                                 compute='_compute_pricing', store=True, precompute=True, readonly=False)
    temporal_type = fields.Selection([], compute="_compute_temporal_type")

    def _compute_start_date(self):
        self.start_date = False

    def _compute_next_invoice_date(self):
        self.next_invoice_date = False

    def _compute_pricing(self):
        self.pricing_id = False

    @api.depends('order_id', 'product_template_id')
    def _compute_temporal_type(self):
        self.temporal_type = False

    def _get_clean_up_values(self):
        return {'start_date': False, 'next_invoice_date': False}

    @api.onchange('product_id')
    def _onchange_product_id(self):
        """Clean product related data if new product is not temporal."""
        if not self.temporal_type:
            values = self._get_clean_up_values()
            self.update(values)

    @api.depends('temporal_type')
    def _compute_product_updatable(self):
        temporal_lines = self.filtered('temporal_type')
        super(SaleOrderLine, self - temporal_lines)._compute_product_updatable()
        temporal_lines.product_updatable = True

    def _get_price_rule_id(self, **product_context):
        self.ensure_one()

        price_computing_kwargs = self._get_price_computing_kwargs()
        if self.temporal_type\
           and self.order_id.pricelist_id._enable_temporal_price(**price_computing_kwargs):
            order_date = self.order_id.date_order or fields.Date.today()
            product = self.product_id.with_context(**product_context)
            qty = self.product_uom_qty or 1.0
            return self.order_id.pricelist_id._compute_price_rule(
                product, qty, self.product_uom, order_date, **price_computing_kwargs)[product.id]

        return super()._get_price_rule_id(**product_context)
