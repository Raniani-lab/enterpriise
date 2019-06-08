# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models


class RentalSchedule(models.Model):
    _name = "sale.rental.schedule"
    _inherit = "sale.rental.report.abstract"
    _description = "Rental Schedule"
    _auto = False

    report_line_status = fields.Selection([
        ('reserved', 'Reserved'),
        ('pickedup', 'Pickedup'),
        ('returned', 'Returned'),
    ], string="Lot/SN Status", readonly=True)

    def _report_line_status(self):
        return """
            CASE when sol.qty_delivered = sol.qty_picked_up AND sol.qty_picked_up = sol.product_uom_qty then 'returned'
                when sol.qty_picked_up = sol.product_uom_qty then 'pickedup'
                else 'reserved'
            END as report_line_status
        """

    def _select(self):
        return super(RentalSchedule, self)._select() + """, """ + self._report_line_status()
