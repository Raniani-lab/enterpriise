# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, fields, api, _
from odoo.exceptions import UserError
from odoo.http import request

class ProductTemplate(models.Model):
    _inherit = 'product.template'


    @api.constrains('optional_product_ids')
    def _constraints_optional_product_ids(self):
        for template in self:
            for optional_template in template.optional_product_ids:
                if self.env['product.pricing']._get_first_suitable_pricing(template).recurrence_id != \
                        self.env['product.pricing']._get_first_suitable_pricing(optional_template).recurrence_id:
                    raise UserError(_('You cannot have an optional product that has a different default pricing.'))

    def _website_can_be_added(self, so=None, pricelist=None, pricing=None, product=None):
        """ Return true if the product/template can be added to the active SO
        """
        if not self.recurring_invoice:
            return True
        website = self.env['website'].get_current_website()
        so = so or website and request and website.sale_get_order()
        if not so or not so.recurrence_id:
            return True
        if not pricing:
            pricelist = pricelist or website.get_current_pricelist()
            pricing = pricing or self.env['product.pricing']._get_first_suitable_pricing(product or self, pricelist)
        return so.recurrence_id == pricing.recurrence_id

    def _get_additionnal_combination_info(self, product_or_template, quantity, date, website):
        res = super()._get_additionnal_combination_info(product_or_template, quantity, date, website)

        if not product_or_template.recurring_invoice:
            return res

        currency = website.currency_id
        pricelist = website.pricelist_id

        pricing = self.env['product.pricing']._get_first_suitable_pricing(
            product_or_template, pricelist)
        if not pricing:
            res.update({
                'is_subscription': True,
                'is_recurrence_possible': False,
            })
            return res

        unit_price = pricing.price
        if pricing.currency_id != currency:
            unit_price = pricing.currency_id._convert(
                from_amount=unit_price,
                to_currency=currency,
                company=self.env.company,
                date=date,
            )

        # apply taxes
        product_taxes = res['product_taxes']
        if product_taxes:
            unit_price = self.env['product.template']._apply_taxes_to_price(
                unit_price, currency, product_taxes, res['taxes'], product_or_template,
            )

        recurrence = pricing.recurrence_id
        return {
            **res,
            'is_subscription': True,
            'price': unit_price,
            'is_recurrence_possible': product_or_template._website_can_be_added(
                pricelist=pricelist, pricing=pricing),
            'subscription_duration': recurrence.duration,
            'subscription_unit': recurrence.unit,
            'temporal_unit_display': recurrence.temporal_unit_display,
        }

    # Search bar
    def _search_render_results_prices(self, mapping, combination_info):
        if not combination_info.get('is_subscription'):
            return super()._search_render_results_prices(mapping, combination_info)

        if not combination_info['is_recurrence_possible']:
            return '', 0

        return self.env['ir.ui.view']._render_template(
            'website_sale_subscription.subscription_search_result_price',
            values={
                'currency': mapping['detail']['display_currency'],
                'price': combination_info['price'],
                'duration': combination_info['subscription_duration'],
                'unit': combination_info['subscription_unit'],
            }
        ), 0

    def _get_sales_prices(self, pricelist, fiscal_position):
        prices = super()._get_sales_prices(pricelist, fiscal_position)

        currency = pricelist.currency_id or self.env.company.currency_id
        date = fields.Date.context_today(self)
        for template in self.filtered('recurring_invoice'):
            pricing = self.env['product.pricing']._get_first_suitable_pricing(template, pricelist)
            if not pricing:
                prices[template.id].update({
                    'is_subscription': True,
                    'is_recurrence_possible': False,
                })
                continue

            unit_price = pricing.price

            # curr conversion
            if currency != pricing.currency_id:
                unit_price = pricing.currency_id._convert(
                    from_amount=unit_price,
                    to_currency=currency,
                    company=self.env.company,
                    date=date,
                )

            # taxes application
            product_taxes = template.sudo().taxes_id.filtered(lambda t: t.company_id == t.env.company)
            if product_taxes:
                taxes = fiscal_position.map_tax(product_taxes)
                unit_price = self.env['product.template']._apply_taxes_to_price(
                    unit_price, currency, product_taxes, taxes, template)

            recurrence = pricing.recurrence_id
            prices[template.id].update({
                'is_subscription': True,
                'price_reduce': unit_price,
                'is_recurrence_possible': template._website_can_be_added(
                    pricelist=pricelist, pricing=pricing),
                'temporal_unit_display': recurrence.temporal_unit_display,
            })
        return prices

    def _website_show_quick_add(self):
        self.ensure_one()
        return super()._website_show_quick_add() and self._website_can_be_added()

    def _can_be_added_to_cart(self):
        self.ensure_one()
        return super()._can_be_added_to_cart() and self._website_can_be_added()
