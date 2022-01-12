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
    next_invoice_date = fields.Datetime(string='Date of Next Invoice',
                                        compute='_compute_next_invoice_date', readonly=False, store=True, precompute=True,
                                        help="The next invoice will be created on this date then the period will be extended.")
    pricelist_id = fields.Many2one(related='order_id.pricelist_id')
    pricing_id = fields.Many2one('product.pricing',
                                 domain="[('id', 'in', product_pricing_ids), '|', ('pricelist_id', '=', False), ('pricelist_id', '=', pricelist_id)]",
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

    @api.depends('temporal_type')
    def _compute_price_unit(self):
        temporal_lines = self.filtered('temporal_type')
        super(SaleOrderLine, self - temporal_lines)._compute_price_unit()
        temporal_lines._update_temporal_prices()

    def _update_temporal_prices(self):
        # Apply correct temporal prices with respect to pricelist
        for sol in self.filtered('temporal_type'):
            pricing_args = {'pricelist': sol.order_id.pricelist_id, 'company': sol.company_id,
                            'currency': sol.currency_id}
            duration_dict = {}
            if sol.pricing_id:
                pricing_args.update(duration=sol.pricing_id.duration, unit=sol.pricing_id.unit)
            elif sol.start_date and sol.next_invoice_date:
                pricing_args.update(start_date=sol.start_date, end_date=sol.next_invoice_date)
                duration_dict = self.env['product.pricing']._compute_duration_vals(sol.start_date,
                                                                                   sol.next_invoice_date)
            else:
                sol.price_unit = sol.product_id.lst_price
                continue
            pricing = sol.product_id._get_best_pricing_rule(**pricing_args)
            if not pricing:
                sol.price_unit = sol.product_id.lst_price
                continue
            if duration_dict:
                price = pricing._compute_price(duration_dict[pricing.unit], pricing.unit)
            else:
                price = pricing._compute_price(sol.pricing_id.duration, sol.pricing_id.unit)
            if pricing.currency_id != sol.currency_id:
                price = pricing.currency_id._convert(
                    from_amount=price,
                    to_currency=sol.currency_id,
                    company=sol.company_id,
                    date=fields.Date.today(),
                )
            sol.price_unit = price

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
