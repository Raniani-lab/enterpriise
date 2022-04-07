# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import math
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.tools import format_amount

# For our use case: pricing depending on the duration, the values should be sufficiently different from one plan to
# another to not suffer from the approcimation that all months are 31 longs.
# otherwise, 31 days would result in 2 month.
PERIOD_RATIO = {
    'hour': 1,
    'day': 24,
    'week': 24 * 7,
    'month': 24*31, # average number of days per month over the year
    'year': 24*31*12,
}


class ProductPricing(models.Model):
    """Temporal pricing rules."""

    _name = 'product.pricing'
    _description = 'Pricing rule of temporal products'
    _order = 'price'

    name = fields.Char(compute='_compute_name')
    description = fields.Char(compute='_compute_description')
    duration = fields.Integer(string="Duration", required=True, default=1, help="Minimum duration before this rule is applied. If set to 0, it represents a fixed temporal price.")
    unit = fields.Selection([("hour", "Hours"), ("day", "Days"), ("week", "Weeks"), ("month", "Months"), ('year', 'Years')],
                            string="Unit", required=True, default='day')
    price = fields.Monetary(string="Price", required=True, default=1.0)
    currency_id = fields.Many2one('res.currency', 'Currency', default=lambda self: self.env.company.currency_id.id, required=True)
    product_template_id = fields.Many2one('product.template', string="Product Templates", help="Select products on which this pricing will be applied.")
    product_variant_ids = fields.Many2many('product.product', string="Product Variants",
                                           help="Select Variants of the Product for which this rule applies. Leave empty if this rule applies for any variant of this template.")
    pricelist_id = fields.Many2one('product.pricelist', compute='_compute_pricelist_id', store=True, readonly=False)
    company_id = fields.Many2one('res.company', related='pricelist_id.company_id')

    @api.depends('duration', 'unit')
    def _compute_name(self):
        for pricing in self:
            pricing.name = _("%s %s", pricing.duration, pricing.unit)

    def _compute_description(self):
        for pricing in self:
            description = ""
            if pricing.currency_id.position == 'before':
                description += format_amount(self.env, amount=pricing.price, currency=pricing.currency_id)
            else:
                description += format_amount(self.env, amount=pricing.price, currency=pricing.currency_id)
            description += _("/%s", pricing.unit)
            pricing.description = description

    def _compute_pricelist_id(self):
        for pricing in self.filtered('pricelist_id'):
            pricing.currency_id = pricing.pricelist_id.currency_id

    def _compute_price(self, duration, unit):
        """Compute the price for a specified duration of the current pricing rule.
        :param float duration: duration in hours
        :param str unit: duration unit (hour, day, week)
        :return float: price
        """
        self.ensure_one()
        if duration <= 0 or self.duration <= 0:
            return self.price
        if unit != self.unit:
            converted_duration = math.ceil((duration * PERIOD_RATIO[unit]) / (self.duration * PERIOD_RATIO[self.unit]))
        else:
            converted_duration = math.ceil(duration / self.duration)
        return self.price * converted_duration

    @api.model
    def _compute_duration_vals(self, start_date, end_date):
        duration = end_date - start_date
        vals = dict(hour=(duration.days * 24 + duration.seconds / 3600))
        vals['day'] = math.ceil(vals['hour'] / 24)
        vals['week'] = math.ceil(vals['day'] / 7)
        duration_diff = relativedelta(end_date, start_date)
        months = 1 if duration_diff.days or duration_diff.hours or duration_diff.minutes else 0
        months += duration_diff.months
        months += duration_diff.years * 12
        vals['month'] = months
        vals['year'] = months/12
        return vals

    _sql_constraints = [
        ('temporal_pricing_duration', "CHECK(duration >= 0)", "The pricing duration has to be greater or equal to 0."),
        ('temporal_pricing_price', "CHECK(price >= 0)", "The pricing price has to be greater or equal to 0."),
    ]

    def _applies_to(self, product):
        """ Check whether current pricing applies to given product.
        :param product.product product:
        :return: true if current pricing is applicable for given product, else otherwise.
        """
        self.ensure_one()
        return (
            self.product_template_id == product.product_tmpl_id
            and (
                not self.product_variant_ids
                or product in self.product_variant_ids))

    def _get_pricing_samples(self):
        """ Get the pricing matching each type of periodicity.
        :returns: recordset containing one pricing per periodicity type
        """
        available_periodicities = set(self.mapped(lambda p: (p.duration, p.unit)))
        result = self.env['product.pricing']
        for period in available_periodicities:
            result |= self.filtered(lambda p: p.duration == period[0] and p.unit == period[1])[:1]
        return result
