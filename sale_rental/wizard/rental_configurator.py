# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import math
from dateutil.relativedelta import relativedelta
from odoo import api, fields, models

from ..models.rental_pricing import PERIOD_RATIO


class RentalWizard(models.TransientModel):
    _name = 'rental.wizard'
    _description = 'Configure the rental of a product'

    rental_order_line_id = fields.Many2one('sale.order.line', on_delete='cascade')  # When wizard used to edit a Rental SO line

    product_id = fields.Many2one(
        'product.product', "Product", required=True, on_delete='cascade',
        domain=[('rent_ok', '=', True)], help="Product to rent (has to be rentable)")

    pickup_date = fields.Datetime(
        string="Pickup", required=True, help="Date of Pickup",
        default=lambda s: fields.Datetime.now() + relativedelta(minute=0, second=0, hours=1))
    return_date = fields.Datetime(
        string="Return", required=True, help="Date of Return",
        default=lambda s: fields.Datetime.now() + relativedelta(minute=0, second=0, hours=1, days=1))

    quantity = fields.Float("Quantity", default=1, required=True)  # Can be changed on SO line later if needed

    duration = fields.Float(
        string="Duration in hours", compute="_compute_duration_pricing",
        help="Duration of the rental (in hours)")
    duration_display = fields.Float(
        string="Duration", compute="_compute_duration_pricing",
        help="Duration of the rental (in unit of the pricing)")
    pricing_id = fields.Many2one(
        'rental.pricing', compute="_compute_duration_pricing",
        string="Pricing", help="Best Pricing Rule based on duration")
    duration_unit = fields.Selection([("hour", "Hours"), ("day", "Days"), ("week", "Weeks")],
                                     string="Unit", required=True, default='day',
                                     compute="_compute_duration_pricing")

    currency_id = fields.Many2one('res.currency', related='pricing_id.currency_id')
    unit_price = fields.Monetary(
        string="Unit Price", help="Best unit price for specified duration (less expensive).",
        readonly=False, default=0.0, required=True)

    rented_qty_during_period = fields.Float(
        string="Quantity reserved", readonly=True,
        help="Quantity reserved by other Rental lines during the given period",
        compute='_compute_rented_during_period')

    # TODO as this information isn't shown anymore.
    # Either remove the field and computation
    # Or show the information again.
    @api.depends('pickup_date', 'return_date', 'product_id')
    def _compute_rented_during_period(self):
        if not self.product_id or not self.pickup_date or not self.return_date:
            return
        else:
            # When the wizard is used to edit a rental line : the quantity displayed as reserved
            # shouldn't include the quantity of the edited rental order line (if its SO is confirmed)
            fro, to = self.product_id._unavailability_period(self.pickup_date, self.return_date)
            self.rented_qty_during_period = self.product_id._get_rented_qty(
                fro, to,
                ignored_soline_id=self.rental_order_line_id and self.rental_order_line_id.id
            )

    @api.depends('pickup_date', 'return_date')
    def _compute_duration_pricing(self):
        """ Process dates to compute duration and pricing for the selected period. """
        for wizard in self:
            pricing, unit_price, duration, duration_display, duration_unit = False, 0, 0, 0, 'day'
            if wizard.pickup_date and wizard.return_date:
                duration = wizard.return_date - wizard.pickup_date
                hours = duration.days*24 + duration.seconds / 3600
                duration = hours
                if duration % 7*24 == 0:
                    duration_unit = 'week'
                elif duration % 24 == 0:
                    duration_unit = 'day'
                else:
                    duration_unit = 'hour'
            if wizard.product_id:
                pricing = wizard.product_id._get_best_pricing_rule(duration)
                unit_price = pricing and pricing.compute_price(duration) or wizard.product_id.lst_price
                duration_display = hours / PERIOD_RATIO[duration_unit]
            wizard.update({
                'pricing_id': pricing and pricing.id,
                'unit_price': unit_price,
                'duration': duration,
                'duration_display': duration_display,
                'duration_unit': duration_unit
            })

    _sql_constraints = [
        ('rental_period_coherence',
            "CHECK(pickup_date < return_date)",
            "Please choose a return date that is after the pickup date."),
    ]
