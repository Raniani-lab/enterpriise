# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class HelpdeskSaleCouponGenerate(models.TransientModel):
    _name = "helpdesk.sale.coupon.generate"
    _description = 'Generate Sales Coupon from Helpdesk'

    def _get_default_program(self):
        return self.env['coupon.program'].search([('program_type', '=', 'coupon_program')], limit=1, order='sequence')

    ticket_id = fields.Many2one('helpdesk.ticket')
    company_id = fields.Many2one(related="ticket_id.company_id")
    program = fields.Many2one('coupon.program', string="Coupon Program", default=_get_default_program, domain=lambda self: [('program_type', '=', 'coupon_program'), '|', ('company_id', '=', False), ('company_id', '=', self.ticket_id.company_id.id)])

    def generate_coupon(self):
        """Generates a coupon for the selected program and the partner linked
        to the ticket
        """
        vals = {
            'partner_id': self.ticket_id.partner_id.id,
            'state': 'new',
            'program_id': self.program.id,
        }
        coupon = self.env['coupon.coupon'].sudo().create(vals)
        self.ticket_id.coupon_ids |= coupon
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'helpdesk.sale.coupon',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_coupon_id': coupon.id,
                'default_ticket_id': self.ticket_id.id,
            },
        }
