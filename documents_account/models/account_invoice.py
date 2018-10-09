# -*- coding: utf-8 -*-
from odoo import models, _


class AccountInvoice(models.Model):
    _inherit = ['account.invoice']

    def _get_vendor_display_info(self):
        super(AccountInvoice, self)._get_vendor_display_info()
        for invoice in self:
            vendor_display_name = invoice.partner_id.name
            if not vendor_display_name and not invoice.source_email:
                vendor_display_name = _('Created by: ') + invoice.create_uid.name
                invoice.vendor_display_name = vendor_display_name
                invoice.invoice_icon = '#'
