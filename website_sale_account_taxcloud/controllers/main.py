# -*- coding: utf-8 -*-

from odoo import _
from odoo.exceptions import ValidationError
from odoo.http import request

from odoo.addons.website_sale.controllers import main

class WebsiteSale(main.WebsiteSale):

    def _get_shop_payment_values(self, order, **kwargs):
        res = super(WebsiteSale, self)._get_shop_payment_values(order, **kwargs)
        res['on_payment_step'] = True

        return res

    def checkout_form_validate(self, mode, all_form_values, data):
        errors, error_msg = super(WebsiteSale, self).checkout_form_validate(mode, all_form_values, data)

        order = request.website.sale_get_order()
        if order.fiscal_position_id.is_taxcloud:
            try:
                order.validate_taxes_on_sales_order()
            except ValidationError:
                errors['taxcloud'] = 'error'
                error_msg.append(_("This address does not appear to be valid. Please make sure it has been filled in correctly."))

        return errors, error_msg
