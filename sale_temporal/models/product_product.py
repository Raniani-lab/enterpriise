# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ProductProduct(models.Model):
    _inherit = 'product.product'

    def _get_best_pricing_rule(self, **kwargs):
        """ Return the best pricing rule for the given duration.
        :param float duration: duration, in unit uom
        :param str unit: duration unit (hour, day, week)
        :param datetime start_date:
        :param datetime end_date:
        :return: least expensive pricing rule for given duration
        """
        self.ensure_one()
        best_pricing_rule = self.env['product.pricing']
        if not self.product_pricing_ids:
            return best_pricing_rule
        # Two possibilities: start_date and end_date are provided or the duration with its unit.
        start_date, end_date = kwargs.get('start_date', False), kwargs.get('end_date', False)
        duration, unit = kwargs.get('duration', False), kwargs.get('unit', '')
        pricelist = kwargs.get('pricelist', self.env['product.pricelist'])
        currency = kwargs.get('currency', self.env.company.currency_id)
        company = kwargs.get('company', self.env.company)
        duration_dict = {}
        if start_date and end_date:
            duration_dict = self.env['product.pricing']._compute_duration_vals(start_date, end_date)
        elif not (duration and unit):
            return best_pricing_rule  # no valid input to compute duration.
        min_price = float("inf")  # positive infinity
        available_pricings = self.product_pricing_ids.filtered(lambda p: p.pricelist_id == pricelist)
        if not available_pricings:
            # If no pricing is defined for given pricelist: fallback on generic pricings
            available_pricings = self.product_pricing_ids.filtered(lambda p: not p.pricelist_id)
        for pricing in available_pricings:
            if pricing._applies_to(self):
                if duration and unit:
                    price = pricing._compute_price(duration, unit)
                else:
                    price = pricing._compute_price(duration_dict[pricing.unit], pricing.unit)
                if pricing.currency_id != currency:
                    price = pricing.currency_id._convert(
                        from_amount=price,
                        to_currency=currency,
                        company=company,
                        date=fields.Date.today(),
                    )
                if price < min_price:
                    min_price, best_pricing_rule = price, pricing
        return best_pricing_rule
