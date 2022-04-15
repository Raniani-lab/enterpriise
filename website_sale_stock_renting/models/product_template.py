# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta

from odoo import fields, models

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    def _get_combination_info(
        self, combination=False, product_id=False, add_qty=1, pricelist=False,
        parent_combination=False, only_template=False
    ):
        """Override to improve information about rental product stock.

        Free quantity of rental product is the minimal amount of available quantities during the
        given period.
        """
        self.ensure_one()

        combination_info = super()._get_combination_info(
            combination=combination, product_id=product_id, add_qty=add_qty, pricelist=pricelist,
            parent_combination=parent_combination, only_template=only_template
        )

        if not self.env.context.get('website_sale_stock_get_quantity'):
            return combination_info

        if self.rent_ok and combination_info['product_id'] and not self.allow_out_of_stock_order:
            start_date = self.env.context.get('start_date')
            end_date = self.env.context.get('end_date')
            if end_date and start_date:
                product = self.env['product.product'].sudo().browse(combination_info['product_id'])
                warehouse_id = self.env['website'].get_current_website()._get_warehouse_available()
                combination_info['free_qty'] = min(
                    avail['quantity_available']
                    for avail in product._get_availabilities(start_date, end_date, warehouse_id)
                )
        return combination_info

    def _get_default_start_date(self):
        """ Override to take the padding time into account """
        if self.preparation_time > 24:
            return self._get_first_potential_date(
                fields.Datetime.now() + relativedelta(
                    hours=self.preparation_time, minute=0, second=0, microsecond=0
                )
            )
        return super()._get_default_start_date()
