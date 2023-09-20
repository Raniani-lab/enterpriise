# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class SaleOrderOption(models.Model):
    _inherit = 'sale.order.option'

    def add_option_to_order(self):
        """ Override to add the rental context so that new SOL can be flagged as rental """
        if self.order_id.is_rental_order:
            self = self.with_context(in_rental_app=True)
        return super().add_option_to_order()

    def _get_values_to_add_to_order(self):
        """ Override to remove the name and force its recomputation to add the period on the SOL """
        vals = super()._get_values_to_add_to_order()
        if self.order_id.is_rental_order:
            vals.pop('name')
        return vals
