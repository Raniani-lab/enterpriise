# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.osv import expression


class SaleOrderTemplateLine(models.Model):
    _inherit = 'sale.order.template.line'

    @api.model
    def _product_id_domain(self):
        """ Override to allow users to add a rental product to a quotation template line """
        domain = super()._product_id_domain()
        if self.env.context.get('in_rental_app'):
            domain = expression.OR([domain, [('rent_ok', '=', True)]])
        return domain
