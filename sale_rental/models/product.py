# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

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

    def _get_best_pricing_rule(self, **kwargs):
        """Return the best pricing rule for the given duration.

        :param float duration: duration, in unit uom
        :param str unit: duration unit (hour, day, week)
        :return: least expensive pricing rule for given duration
        :rtype: rental.pricing
        """
        self.ensure_one()
        if not self.rental_pricing_ids:
            return self.env['rental.pricing']
        pickup_date, return_date = kwargs.get('pickup_date', False), kwargs.get('return_date', False)
        duration, unit = kwargs.get('duration', False), kwargs.get('unit', '')
        if pickup_date and return_date:
            duration_dict = self.env['rental.pricing']._compute_duration_vals(pickup_date, return_date)
        elif not(duration and unit):
            return self.env['rental.pricing']  # no valid input to compute duration.
        min_price = float("inf")  # positive infinity
        best_pricing_rule = self.env['rental.pricing']
        for pricing in self.rental_pricing_ids:
            if pricing.applies_to(self):
                if duration and unit:
                    price = pricing._compute_price(duration, unit)
                else:
                    price = pricing._compute_price(duration_dict[pricing.unit], pricing.unit)

                if price < min_price:
                    min_price, best_pricing_rule = price, pricing
        return best_pricing_rule

    def action_view_rentals(self):
        action = self.env.ref('sale_rental.rental_schedule_view_gantt_products').read()[0]
        action['context'] = {
            'products': self.ids,
        }  # Date domain???
        return action
