# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import route
from odoo.addons.account.controllers.portal import CustomerPortal


class AvataxCustomerPortal(CustomerPortal):

    @route()
    def portal_my_invoice_detail(self, *args, **kw):
        response = super().portal_my_invoice_detail(*args, **kw)
        if 'invoice' not in response.qcontext:
            return response

        invoice = response.qcontext['invoice']
        if invoice.state == 'draft' and invoice.fiscal_position_id.is_avatax:
            invoice.button_update_avatax()

        return response
