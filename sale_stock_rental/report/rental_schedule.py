# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class RentalSchedule(models.Model):
    _inherit = "sale.rental.schedule"

    lot_id = fields.Many2one('stock.production.lot', 'Serial Number', readonly=True)
    warehouse_id = fields.Many2one('stock.warehouse', 'Warehouse', readonly=True)
    # TODO color depending on report_line_status

    def _get_product_name(self):
        return """COALESCE(lot_info.name, t.name) as product_name,"""

    def _id(self):
        return """COALESCE(lot_info.lot_id, sol.id) as id,"""

    def _quantity(self):
        return """
            CASE WHEN lot_info.lot_id IS NULL then sum(sol.product_uom_qty / u.factor * u2.factor) ELSE 1.0 END as product_uom_qty,
            CASE WHEN lot_info.lot_id IS NULL then sum(sol.qty_picked_up / u.factor * u2.factor)
                WHEN lot_info.report_line_status = 'reserved' then 0.0
                ELSE 1.0 END as qty_picked_up,
            CASE WHEN lot_info.lot_id IS NULL then sum(sol.qty_delivered / u.factor * u2.factor)
                WHEN lot_info.report_line_status = 'returned' then 1.0
                ELSE 0.0 END as qty_delivered,
        """

    def _report_line_status(self):
        return """
            CASE when lot_info.lot_id is NULL then
                CASE when sol.qty_delivered = sol.qty_picked_up AND sol.qty_picked_up = sol.product_uom_qty then 'returned'
                    when sol.qty_picked_up = sol.product_uom_qty then 'pickedup'
                    else 'reserved'
                END
            ELSE lot_info.report_line_status
            END as report_line_status
        """

    def _with(self):
        return """
            WITH ordered_lots (lot_id, name, sol_id, report_line_status) AS
                (SELECT
                    lot.id as lot_id,
                    lot.name,
                    sol.id as sol_id,
                    CASE when returned.stock_production_lot_id IS NOT NULL then 'returned'
                        when pickedup.stock_production_lot_id IS NOT NULL then 'pickedup'
                        else 'reserved' END as report_line_status
                    FROM
                        sale_order_line sol
                            LEFT OUTER JOIN rental_reserved_lot_rel res ON res.sale_order_line_id=sol.id
                            LEFT OUTER JOIN rental_pickedup_lot_rel pickedup ON pickedup.sale_order_line_id=sol.id
                            LEFT OUTER JOIN rental_returned_lot_rel returned ON returned.sale_order_line_id=sol.id AND returned.stock_production_lot_id = res.stock_production_lot_id,
                        stock_production_lot lot
                    WHERE
                        lot.id = res.stock_production_lot_id
                        OR lot.id = pickedup.stock_production_lot_id
                )
        """

    def _select(self):
        return super(RentalSchedule, self)._select() + """,
            lot_info.lot_id as lot_id,
            s.warehouse_id as warehouse_id
        """

    def _from(self):
        return super(RentalSchedule, self)._from() + """
            LEFT OUTER JOIN ordered_lots lot_info ON sol.id=lot_info.sol_id
        """

    def _groupby(self):
        return super(RentalSchedule, self)._groupby() + """,
            lot_info.lot_id,
            lot_info.name,
            lot_info.report_line_status"""
