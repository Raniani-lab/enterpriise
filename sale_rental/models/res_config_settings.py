# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # RENTAL company defaults :

    # Padding Time

    padding_time = fields.Float(
        string="Padding Time",
        related='company_id.padding_time', readonly=False,
        help="This is the default padding time set on newly created products. You can change it in the product form.")

    # Extra Costs

    extra_hour = fields.Float(
        "Extra Hour", related="company_id.extra_hour", readonly=False,
        help="Those are the default extra costs set on newly created products. You can change them from the product form.")
    extra_day = fields.Float(
        "Extra Day", related="company_id.extra_day", readonly=False,
        help="Those are the default extra costs set on newly created products. You can change them from the product form.")
    # extra_week = fields.Monetary("Extra Week")
    min_extra_hour = fields.Integer("Minimum delay time before applying fines.", related="company_id.min_extra_hour", readonly=False)
    # week uom disabled in rental for the moment
    extra_product = fields.Many2one(
        'product.product', string="Delay Product",
        help="The product is used to add the cost to the sales order", related="company_id.extra_product",
        readonly=False, domain="[('type', '=', 'service')]")

    module_sale_rental_sign = fields.Boolean(string="Sign Documents")
