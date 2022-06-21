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
    temporal_type = fields.Selection([], compute="_compute_temporal_type")

    #=== COMPUTE METHODS ===#
    def _compute_start_date(self):
        self.start_date = False

    def _compute_next_invoice_date(self):
        self.next_invoice_date = False

    @api.depends('order_id', 'product_template_id')
    def _compute_temporal_type(self):
        self.temporal_type = False

    # Overrides

    def _compute_pricelist_item_id(self):
        """Discard pricelist item computation for temporal lines.

        This will disable the standard discount computation as well
        because no pricelist rule was found.
        """
        temporal_lines = self.filtered('temporal_type')
        super(SaleOrderLine, self - temporal_lines)._compute_pricelist_item_id()
        temporal_lines.pricelist_item_id = False

    @api.depends('temporal_type')
    def _compute_product_updatable(self):
        temporal_lines = self.filtered('temporal_type')
        super(SaleOrderLine, self - temporal_lines)._compute_product_updatable()
        temporal_lines.product_updatable = True

    #=== ONCHANGE METHODS ===#

    @api.onchange('product_id')
    def _onchange_product_id(self):
        """Clean product related data if new product is not temporal."""
        if not self.temporal_type:
            values = self._get_clean_up_values()
            self.update(values)

    #=== BUSINESS METHODS ===#

    def _get_clean_up_values(self):
        return {'start_date': False, 'next_invoice_date': False}

    def _get_pricelist_price(self):
        """ Custom price computation for temporal lines.

        The displayed price will only be the price given
        by the product.pricing rules matching the given line information
        (product, period, pricelist, ...).
        """
        self.ensure_one()
        if self.temporal_type:
            return self.order_id.pricelist_id._get_product_price(
                self.product_id.with_context(**self._get_product_price_context()),
                self.product_uom_qty or 1.0,
                self.product_uom,
                date=self.order_id.date_order or fields.Date.today(),
                **self._get_price_computing_kwargs()
            )
        return super()._get_pricelist_price()

    def _get_price_computing_kwargs(self):
        """ Get optional fields which may impact price computing """
        self and self.ensure_one() # len(self) <= 1
        return {}
