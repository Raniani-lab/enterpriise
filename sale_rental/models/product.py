# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta
from odoo import api, fields, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    def _default_extra_hourly(self):
        return self.env.company.extra_hour or 0.0

    def _default_extra_daily(self):
        return self.env.company.extra_day or 0.0

    def _default_preparation_time(self):
        return self.env.company.padding_time or 0.0

    rent_ok = fields.Boolean(
        string="Can be Rented",
        help="Allow renting of this product.")
    qty_in_rent = fields.Float("Quantity currently in rent", compute='_get_qty_in_rent')
    rental_pricing_ids = fields.One2many(
        'rental.pricing', 'product_template_id',
        string="Rental Pricings", auto_join=True, copy=True)

    # Delays pricing

    extra_hourly = fields.Float("Extra Hour", default=_default_extra_hourly, help="Fine by hour overdue", company_dependent=True)
    extra_daily = fields.Float("Extra Day", default=_default_extra_daily, help="Fine by day overdue", company_dependent=True)

    # Padding Time

    preparation_time = fields.Float(
        string="Before Pickup", default=_default_preparation_time,
        help="Make the product unavailable between 2 rentals (e.g. admin processing, repair).", company_dependent=True)

    def _get_qty_in_rent(self):
        rentable = self.filtered('rent_ok')
        not_rentable = self - rentable
        not_rentable.update({'qty_in_rent': 0.0})
        for template in rentable:
            template.qty_in_rent = sum(template.mapped('product_variant_ids.qty_in_rent'))

    def action_view_rentals(self):
        """Access Gantt view of sale_order_line, filtered on variants of current product."""
        action = self.env.ref('sale_rental.rental_schedule_view_gantt_products').read()[0]
        action['context'] = {'products': self.mapped('product_variant_ids').ids}
        return action


class ProductProduct(models.Model):
    _inherit = 'product.product'

    qty_in_rent = fields.Float("Quantity currently in rent", compute='_get_qty_in_rent')

    def _get_qty_in_rent_domain(self):
        return [
            ('is_rental', '=', True),
            ('product_id', 'in', self.ids),
            ('state', 'in', ['sale', 'done'])]

    def _get_qty_in_rent(self):
        """
        Note: we don't use product.with_context(location=self.env.company.rental_loc_id.id).qty_available
        because there are no stock moves for services (which can be rented).
        """
        active_rental_lines = self.env['sale.order.line'].read_group(
            domain=self._get_qty_in_rent_domain(),
            fields=['product_id', 'qty_picked_up:sum', 'qty_delivered:sum'],
            groupby=['product_id'],
        )
        res = dict((data['product_id'][0], data['qty_picked_up'] - data['qty_delivered']) for data in active_rental_lines)
        for product in self:
            product.qty_in_rent = res.get(product.id, 0)

    def _compute_delay_price(self, duration):
        """Compute daily and hourly delay price.

        :param timedelta duration: datetime representing the delay.
        """
        days = duration.days
        hours = duration.seconds // 3600
        return days * self.extra_daily + hours * self.extra_hourly

    def _get_best_pricing_rule(self, duration):
        """Return the best pricing rule for the given duration.

        :param float duration: duration in hours
        :return: least expensive pricing rule for given duration
        :rtype: rental.pricing
        """
        self.ensure_one()
        if duration < 0 or not self.rental_pricing_ids:
            return
        min_price = float("inf")  # positive infinity
        best_pricing_rule = self.env['rental.pricing']
        for pricing in self.rental_pricing_ids:
            if pricing.applies_to(self):
                price = pricing.compute_price(duration)

                if price < min_price:
                    min_price, best_pricing_rule = price, pricing
        return best_pricing_rule

    def action_view_rentals(self):
        action = self.env.ref('sale_rental.rental_schedule_view_gantt_products').read()[0]
        action['context'] = {
            'products': self.ids,
        }  # Date domain???
        return action

    def _unavailability_period(self, fro, to):
        """Give unavailability period given rental period."""
        return fro - timedelta(hours=self.preparation_time), to

    def _get_rented_qty(self, fro=fields.Datetime.now(), to=None, ignored_soline_id=None):
        domain_extension = [('id', '!=', ignored_soline_id)] if ignored_soline_id else []
        return self._get_max_unavailable_qty_in_period(fro, to, domain_extension)

    def _get_max_unavailable_qty_in_period(self, fro, to=None, domain_extension=None):
        """Return max qty of self (unique) unavailable between fro and to.

        Doesn't count already returned quantities.
        :param datetime fro:
        :param datetime to:
        :param list domain_extension: search domain
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

        qty_always_in_rent_during_period = sum(line.product_uom_qty - line.qty_delivered for line in covers_period)

        return max_qty_rented + qty_always_in_rent_during_period

    def _get_active_rental_lines(self, fro, to, domain=None):
        # TODO what if products are in reparation time (still unavailable)
        # and sol state = 'done', the unavailability won't be correctly counted?
        self.ensure_one()

        Reservation = self.env['sale.order.line']

        domain = domain if domain is not None else []
        domain += [
            ('is_rental', '=', True),
            ('product_id', '=', self.id),
            ('state', 'in', ['sale', 'done']),
        ]

        if not to or fro == to:
            active_lines_at_time_fro = Reservation.search(domain + [
                ('reservation_begin', '<=', fro),
                ('return_date', '>=', fro)
            ])
            return [], [], active_lines_at_time_fro
        else:
            begins_during_period = Reservation.search(domain + [
                ('reservation_begin', '>', fro),
                ('reservation_begin', '<', to)])
            ends_during_period = Reservation.search(domain + [
                ('return_date', '>', fro),
                ('return_date', '<', to),
                ('id', 'not in', begins_during_period.ids)])
            covers_period = Reservation.search(domain + [
                ('reservation_begin', '<=', fro),
                ('return_date', '>=', to)])
            return begins_during_period, ends_during_period, covers_period
