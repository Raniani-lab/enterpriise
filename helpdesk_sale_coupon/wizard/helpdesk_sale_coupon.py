# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HelpdeskSaleCoupon(models.TransientModel):
    _name = "helpdesk.sale.coupon"
    _description = 'Display Coupon from Helpdesk'

    ticket_id = fields.Many2one('helpdesk.ticket')
    coupon_id = fields.Many2one('coupon.coupon')
    code = fields.Char(related='coupon_id.code')
    expiration_date = fields.Date(related='coupon_id.expiration_date')
    state = fields.Selection(related='coupon_id.state')

    def action_coupon_cancel(self):
        return self.coupon_id.action_coupon_cancel()

    def action_coupon_send(self):
        self.ensure_one()
        return self.coupon_id.action_coupon_send()
