# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta
from odoo import api, fields, models


class RentalWizard(models.TransientModel):
    _name = 'rental.wizard'
    _description = 'Configure the rental of a product'

    rental_order_line_id = fields.Many2one('sale.order.line', on_delete='cascade')  # When wizard used to edit a Rental SO line

    product_id = fields.Many2one(
        'product.product', "Product", required=True, on_delete='cascade',
        domain=[('rent_ok', '=', True)], help="Product to rent (has to be rentable)")

    pickup_date = fields.Datetime(
        string="Deliver", required=True, help="Date of Deliver",
        default=lambda s: fields.Datetime.now() + relativedelta(minute=0, second=0, hours=1))
    return_date = fields.Datetime(
        string="Return", required=True, help="Date of Return",
        default=lambda s: fields.Datetime.now() + relativedelta(minute=0, second=0, hours=1, days=1))

    quantity = fields.Float("Quantity", default=1, required=True)  # Can be changed on SO line later if needed

    pricing_id = fields.Many2one(
        'rental.pricing', compute="_compute_pricing",
        string="Pricing", help="Best Pricing Rule based on duration")
    currency_id = fields.Many2one('res.currency', related='pricing_id.currency_id')

    duration = fields.Integer(
        string="Duration", compute="_compute_duration", default=1.0,
        help="Duration of the rental (in unit of the pricing)")
    duration_unit = fields.Selection([("hour", "Hours"), ("day", "Days"), ("week", "Weeks"), ("month", "Months")],
                                     string="Unit", required=True, default='day',
                                     compute="_compute_duration")

    unit_price = fields.Monetary(
        string="Unit Price", help="Best unit price for specified duration (less expensive).",
        readonly=False, default=0.0, required=True)
    pricelist_id = fields.Many2one('product.pricelist', string='Pricelist')

    @api.depends('pickup_date', 'return_date')
    def _compute_pricing(self):
        for wizard in self:
            if wizard.product_id:
                wizard.pricing_id = wizard.product_id._get_best_pricing_rule(pickup_date=wizard.pickup_date, return_date=wizard.return_date, pricelist=wizard.pricelist_id)

    @api.depends('pricing_id', 'pickup_date', 'return_date')
    def _compute_duration(self):
        for wizard in self:
            if wizard.pickup_date and wizard.return_date:
                duration_dict = self.env['rental.pricing']._compute_duration_vals(wizard.pickup_date, wizard.return_date)
                if wizard.pricing_id:
                    wizard.update({
                        'duration_unit': wizard.pricing_id.unit,
                        'duration': duration_dict[wizard.pricing_id.unit]
                    })
                else:
                    wizard.update({
                        'duration_unit': 'day',
                        'duration': duration_dict['day']
                    })

    @api.onchange('pricing_id', 'duration', 'duration_unit')
    def _compute_unit_price(self):
        for wizard in self:
            if wizard.pricing_id and wizard.duration > 0:
                wizard.unit_price = wizard.pricing_id._compute_price(wizard.duration, wizard.duration_unit)
            elif wizard.duration > 0:
                wizard.unit_price = wizard.product_id.lst_price

    _sql_constraints = [
        ('rental_period_coherence',
            "CHECK(pickup_date < return_date)",
            "Please choose a return date that is after the pickup date."),
    ]
