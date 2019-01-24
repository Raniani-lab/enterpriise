# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HelpdeskTicket(models.Model):
    _inherit = 'helpdesk.ticket'

    sale_order_ids = fields.Many2many('sale.order', compute="compute_sale_order_ids")
    sale_order_id = fields.Many2one('sale.order', string='Sales Order', domain="[('id', 'in', sale_order_ids)]")

    @api.depends('partner_id')
    def compute_sale_order_ids(self):
        for ticket in self:
            domain = []
            if ticket.partner_id.commercial_partner_id:
                domain = [('partner_id', 'child_of', ticket.partner_id.commercial_partner_id.id)]
            ticket.sale_order_ids = ticket.env['sale.order'].search(domain)
