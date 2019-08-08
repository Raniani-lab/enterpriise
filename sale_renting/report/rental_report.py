# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models


class RentalReport(models.Model):
    _name = "sale.rental.report"
    _inherit = "sale.rental.report.abstract"
    _description = "Rental Analysis Report"
    _auto = False

    qty_to_invoice = fields.Float('Qty To Invoice', readonly=True)
    qty_invoiced = fields.Float('Qty Invoiced', readonly=True)
    price_total = fields.Float('Total', readonly=True)
    price_subtotal = fields.Float('Untaxed Total', readonly=True)

    def _quantity(self):
        return super(RentalReport, self)._quantity() + """
            sum(sol.qty_invoiced / u.factor * u2.factor) as qty_invoiced,
            sum(sol.qty_to_invoice / u.factor * u2.factor) as qty_to_invoice,
        """

    def _price(self):
        return """
            sum(sol.price_total / CASE COALESCE(s.currency_rate, 0) WHEN 0 THEN 1.0 ELSE s.currency_rate END) as price_total,
            sum(sol.price_subtotal / CASE COALESCE(s.currency_rate, 0) WHEN 0 THEN 1.0 ELSE s.currency_rate END) as price_subtotal,
        """
