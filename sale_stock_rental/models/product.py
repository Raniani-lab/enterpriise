# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, exceptions


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    # TODO replace by UI greying of unselectable conflicting choices ?
    @api.constrains('rent_ok', 'tracking')
    def _lot_not_supported_rental(self):
        if self.rent_ok and self.tracking == 'lot':
            raise exceptions.ValidationError("Tracking by lots isn't supported for rental products. \
                \n You should rather change the tracking mode to unique serial numbers.")


class Product(models.Model):
    _inherit = 'product.product'

    def _get_qty_in_rent_domain(self):
        """Allow precising the warehouse_id to get qty currently in rent."""
        if self.env.context.get('warehouse_id', False):
            return super(Product, self)._get_qty_in_rent_domain() + [('order_id.warehouse_id', '=', int(self.env.context.get('warehouse_id')))]
        else:
            return super(Product, self)._get_qty_in_rent_domain()

    def _get_rented_qty(self, fro=fields.Datetime.now(), to=None, ignored_soline_id=None, warehouse_id=None):
        domain_extension = [('id', '!=', ignored_soline_id)] if ignored_soline_id else []
        domain_extension += [('order_id.warehouse_id', '=', warehouse_id)] if warehouse_id else []
        return self._get_max_unavailable_qty_in_period(fro, to, domain_extension)

    """
        ONLY for products where tracking == 'serial' and rent_ok
    """

    def _get_rented_qty_lots(self, fro=fields.Datetime.now(), to=None, ignored_soline_id=None, warehouse_id=None):
        """
        :param datetime fro:
        :param datetime to:
        :param int ignored_soline_id: sale.order.line id
        :param int warehouse_id: stock.warehouse id
        :return tuple(float, array(stock.production.lot)):
        """
        domain_extension = [('id', '!=', ignored_soline_id)] if ignored_soline_id else []
        domain_extension += [('order_id.warehouse_id', '=', warehouse_id)] if warehouse_id else []
        return self._get_quantity_lots_rented_in_period(fro, to, domain_extension)

    def _get_quantity_lots_rented_in_period(self, fro, to, domain_extension):
        """
        :param datetime fro:
        :param datetime to:
        :param list domain_extension: sale.order.line search domain
        :return tuple(float, array(stock.production.lot)):
        """
        def unavailable_qty(so_line):
            return so_line.product_uom_qty - so_line.qty_delivered

        begins_during_period, ends_during_period, covers_period = self._get_active_rental_lines(fro, to, domain_extension)
        active_lines_in_period = begins_during_period + ends_during_period
        max_qty_rented = 0

        # TODO is it more efficient to filter the records active in period
        # or to make another search on all the sale order lines???
        if begins_during_period:
            for date in begins_during_period.mapped('reservation_begin'):
                active_lines_at_date = active_lines_in_period.filtered(
                    lambda line: line.reservation_begin <= date and line.return_date >= date)
                qty_rented_at_date = sum(active_lines_at_date.mapped(unavailable_qty))
                if qty_rented_at_date > max_qty_rented:
                    max_qty_rented = qty_rented_at_date

        qty_always_in_rent_during_period = sum(unavailable_qty(line) for line in covers_period)

        # returns are removed from the count (WARNING : early returns don't support padding times)
        all_lines = (active_lines_in_period + covers_period)
        rented_serial_during_period = all_lines.mapped('unavailable_lot_ids')

        return max_qty_rented + qty_always_in_rent_during_period, rented_serial_during_period
