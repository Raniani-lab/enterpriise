# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.tools import is_html_empty


class SaleOrderCloseReason(models.Model):
    _name = "sale.order.close.reason"
    _order = "sequence, id"
    _description = "Subscription Close Reason"

    name = fields.Char('Reason', required=True, translate=True)
    sequence = fields.Integer(default=10)

    visible_in_portal = fields.Boolean(default=True, required=True)
    retention_message = fields.Html('Message', translate=True, help="Try to prevent customers from leaving and closing their subscriptions, thanks to a catchy message and a call to action.")
    retention_button_text = fields.Char('Button Text', translate=True)
    retention_button_link = fields.Char('Button Link', translate=True)
    empty_retention_message = fields.Boolean(compute='_compute_empty_retention_message')

    @api.depends('retention_message')
    def _compute_empty_retention_message(self):
        for reason in self:
            reason.empty_retention_message = is_html_empty(reason.retention_message)
