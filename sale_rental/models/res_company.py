# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    # RENTAL company defaults :

    # Padding Time

    padding_time = fields.Float(
        string="Before pickup", default=0.0,
        help="The product is considered unavailable * hours before its pickup.")

    # Extra Costs

    extra_hour = fields.Float("Extra Hour", default=0.0)
    extra_day = fields.Float("Extra Day", default=0.0)
    min_extra_hour = fields.Integer("Minimum delay time before applying fines.", default=1)

    extra_product = fields.Many2one(
        'product.product', string="Product",
        help="The product is used to add the cost to the sales order",
        domain="[('type', '=', 'service')]")

    _sql_constraints = [
        ('min_extra_hour',
            "CHECK(min_extra_hour >= 1)",
            "Minimal delay time before applying fines has to be positive."),
    ]
