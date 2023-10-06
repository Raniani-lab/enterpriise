# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.tools import format_amount


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    rent_ok = fields.Boolean(
        string="Can be Rented",
        help="Allow renting of this product.")
    qty_in_rent = fields.Float("Quantity currently in rent", compute='_get_qty_in_rent')
    product_pricing_ids = fields.One2many('product.pricing', 'product_template_id', string="Custom Pricings", auto_join=True, copy=True)
    display_price = fields.Char("Leasing price", help="First leasing pricing of the product", compute="_compute_display_price")

    # Delays pricing

    extra_hourly = fields.Float("Extra Hour", help="Fine by hour overdue", company_dependent=True)
    extra_daily = fields.Float("Extra Day", help="Fine by day overdue", company_dependent=True)

    def _compute_display_price(self):
        temporal_products = self.filtered('rent_ok')
        temporal_priced_products = temporal_products.filtered('product_pricing_ids')
        (self - temporal_products).display_price = ""
        for product in (temporal_products - temporal_priced_products):
            product.display_price = _("%(amount)s (fixed)", amount=format_amount(self.env, product.list_price, product.currency_id))
        # No temporal pricing defined, fallback on list price
        for product in temporal_priced_products:
            product.display_price = product.product_pricing_ids[0].description

    def _get_qty_in_rent(self):
        rentable = self.filtered('rent_ok')
        not_rentable = self - rentable
        not_rentable.update({'qty_in_rent': 0.0})
        for template in rentable:
            template.qty_in_rent = sum(template.mapped('product_variant_ids.qty_in_rent'))

    def action_view_rentals(self):
        """Access Gantt view of rentals (sale.rental.schedule), filtered on variants of the current template."""
        return {
            "type": "ir.actions.act_window",
            "name": _("Scheduled Rentals"),
            "res_model": "sale.rental.schedule",
            "views": [[False, "gantt"]],
            'domain': [('product_id', 'in', self.mapped('product_variant_ids').ids)],
            'context': {
                'search_default_Rentals':1,
                'group_by_no_leaf':1,
                'group_by':[],
                'restrict_renting_products': True,
            }
        }

    @api.depends('rent_ok')
    @api.depends_context('rental_products')
    def _compute_display_name(self):
        super()._compute_display_name()
        if not self._context.get('rental_products'):
            return
        for template in self:
            if template.rent_ok:
                template.display_name = _("%s (Rental)", template.display_name)

    def _get_best_pricing_rule(
        self, product=False, start_date=False, end_date=False, duration=False, unit='', **kwargs
    ):
        """ Return the best pricing rule for the given duration.

        :param ProductProduct product: a product recordset (containing at most one record)
        :param float duration: duration, in unit uom
        :param str unit: duration unit (hour, day, week)
        :param datetime start_date: start date of leasing period
        :param datetime end_date: end date of leasing period
        :return: least expensive pricing rule for given duration
        """
        self.ensure_one()
        best_pricing_rule = self.env['product.pricing']
        if not self.product_pricing_ids:
            return best_pricing_rule
        # Two possibilities: start_date and end_date are provided or the duration with its unit.
        pricelist = kwargs.get('pricelist', self.env['product.pricelist'])
        currency = kwargs.get('currency', self.currency_id)
        company = kwargs.get('company', self.env.company)
        duration_dict = {}
        if start_date and end_date:
            duration_dict = self.env['product.pricing']._compute_duration_vals(start_date, end_date)
        elif not (duration and unit):
            return best_pricing_rule  # no valid input to compute duration.
        min_price = float("inf")  # positive infinity
        Pricing = self.env['product.pricing']
        available_pricings = Pricing._get_suitable_pricings(product or self, pricelist=pricelist)
        for pricing in available_pricings:
            if duration and unit:
                price = pricing._compute_price(duration, unit)
            else:
                price = pricing._compute_price(duration_dict[pricing.recurrence_id.unit], pricing.recurrence_id.unit)
            if pricing.currency_id != currency:
                price = pricing.currency_id._convert(
                    from_amount=price,
                    to_currency=currency,
                    company=company,
                    date=fields.Date.today(),
                )
            # We compare the abs of prices because negative pricing (as a promotion) would trigger the
            # highest discount without it.
            if abs(price) < abs(min_price):
                min_price, best_pricing_rule = price, pricing
        return best_pricing_rule

    def _get_contextual_price(self, product=None):
        self.ensure_one()
        if not (product or self).rent_ok:
            return super()._get_contextual_price(product=product)

        pricelist = self._get_contextual_pricelist()

        quantity = self.env.context.get('quantity', 1.0)
        uom = self.env['uom.uom'].browse(self.env.context.get('uom'))
        date = self.env.context.get('date')
        start_date = self.env.context.get('start_date')
        end_date = self.env.context.get('end_date')
        return pricelist._get_product_price(
            product or self, quantity, uom=uom, date=date, start_date=start_date, end_date=end_date
        )
