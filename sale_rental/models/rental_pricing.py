# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import math
from odoo import fields, models

PERIOD_RATIO = {
    'hour': 1,
    'day': 24,
    'week': 24*7
}


class RentalPricing(models.Model):
    """Rental pricing rules."""

    _name = 'rental.pricing'
    _description = 'Pricing rule of rentals'
    _order = 'unit, duration'

    duration = fields.Float(
        string="Duration", required=True,
        help="Minimum duration before this rule is applied. If set to 0, it represents a fixed rental price.")
    unit = fields.Selection([("hour", "Hour(s)"), ("day", "Day(s)"), ("week", "Week(s)")], string="Unit", required=True, default='day')

    price = fields.Monetary(string="Price", required=True, digits='Product Price', default=1.0)
    currency_id = fields.Many2one(
        'res.currency', 'Currency',
        default=lambda self: self.env.company.currency_id.id,
        required=True)

    product_template_id = fields.Many2one(
        'product.template', string="Product Templates",
        help="Select products on which this pricing will be applied.")

    product_variant_ids = fields.Many2many(
        'product.product', string="Product Variants",
        help="Select Variants of the Product for which this rule applies."
        "\n Leave empty if this rule applies for any variant of this template.")

    def compute_price(self, duration):
        """Compute the price for a specified duration of the current pricing rule.

        :param float duration: duration in hours
        :return float: price
        """
        self.ensure_one()
        # or move product._get_best_pricing_rule code here
        # and support api.multi ?
        if duration <= 0 or self.duration <= 0:
            return self.price
        # we want roudning per days -_-
        pricing_duration_days = self.duration * PERIOD_RATIO[self.unit] / 24.0
        return self.price * math.ceil((duration / 24.0) / pricing_duration_days)

    _sql_constraints = [
        ('rental_pricing_duration',
            "CHECK(duration >= 0)",
            "The pricing duration has to be greater or equal to 0."),
        ('rental_pricing_price',
            "CHECK(price >= 0)",
            "The pricing price has to be greater or equal to 0."),
    ]

    def applies_to(self, product):
        """Check whether current pricing applies to given product.

        :param product.product product:
        :return: true if current pricing is applicable for given product, else otherwise.
        :rtype: bool
        """
        return (
            self.product_template_id == product.product_tmpl_id
            and (
                not self.product_variant_ids
                or product in self.product_variant_ids))
