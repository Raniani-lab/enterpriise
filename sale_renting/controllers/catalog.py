# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request, route
from odoo.addons.sale.controllers.catalog import CatalogController


class CatalogControllerRenting(CatalogController):

    @route()
    def sale_product_catalog_get_sale_order_lines_info(self, order_id, product_ids, **kwargs):
        """ Override to add the rental dates for the price computation """
        order = request.env['sale.order'].browse(order_id)
        return super().sale_product_catalog_get_sale_order_lines_info(
            order_id,
            product_ids,
            start_date=order.rental_start_date,
            end_date=order.rental_return_date,
            **kwargs,
        )

    @route()
    def sale_product_catalog_update_sale_order_line_info(
        self, order_id, product_id, quantity, **kwargs
    ):
        """ Override to add the context to mark the line as rental and the rental dates for the
        price computation
        """
        order = request.env['sale.order'].browse(order_id)
        if order.is_rental_order:
            request.update_context(in_rental_app=True)
            product = request.env['product.product'].browse(product_id)
            if product.rent_ok:
                order._rental_set_dates()
        return super().sale_product_catalog_update_sale_order_line_info(
            order_id,
            product_id,
            quantity,
            start_date=order.rental_start_date,
            end_date=order.rental_return_date,
            **kwargs,
        )
