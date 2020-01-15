# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class HelpdeskSaleCouponGenerate(models.TransientModel):
    _name = "helpdesk.sale.coupon.generate"
    _description = 'Generate Sales Coupon from Helpdesk'

    ticket_id = fields.Many2one('helpdesk.ticket')
    company_id = fields.Many2one(related="ticket_id.company_id")
    program = fields.Many2one('sale.coupon.program', string="Coupon Program", domain=lambda self: [('program_type', '=', 'coupon_program'), '|', ('company_id', '=', False), ('company_id', '=', self.ticket_id.company_id.id)])

    def generate_coupon(self):
        """Generates a coupon for the selected program and the partner linked
        to the ticket
        """
        vals = {
            'partner_id': self.ticket_id.partner_id.id,
            'state': 'new',
            'program_id': self.program.id,
        }
        # Sudo because normally, only sale manager can generate coupons, but here in case of helpdesk, it's usefull
        coupon = self.env['sale.coupon'].sudo().create(vals)
        self.ticket_id.coupon_ids |= coupon
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'sale.coupon',
            'res_id': coupon.id,
            'view_mode': 'form',
        }
