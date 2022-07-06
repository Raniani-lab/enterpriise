# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _

class HelpdeskSaleCouponGenerate(models.TransientModel):
    _name = "helpdesk.sale.coupon.generate"
    _description = 'Generate Sales Coupon from Helpdesk'


    def _get_default_program(self):
        return self.env['loyalty.program'].search([('applies_on', '=', 'current'), ('trigger', '=', 'with_code'), ('program_type', '=', 'coupons')], limit=1)

    ticket_id = fields.Many2one('helpdesk.ticket')
    company_id = fields.Many2one(related="ticket_id.company_id")
    program = fields.Many2one('loyalty.program', string="Coupon Program", default=_get_default_program,
        domain=lambda self: [('applies_on', '=', 'current'), ('trigger', '=', 'with_code'), '|', ('company_id', '=', False), ('company_id', '=', self.company_id.id)])
    points_granted = fields.Float('Coupon Value', default=1)
    points_name = fields.Char(related='program.portal_point_name')
    valid_until = fields.Date("Valid Until")

    def generate_coupon(self):
        """Generates a coupon for the selected program and the partner linked
        to the ticket
        """
        vals = {
            'partner_id': self.ticket_id.partner_id.id,
            'program_id': self.program.id,
            'points': self.points_granted,
            'expiration_date': self.valid_until,
        }
        coupon = self.env['loyalty.card'].sudo().create(vals)
        self.ticket_id.coupon_ids |= coupon
        view = self.env.ref('helpdesk_sale_loyalty.loyalty_card_view_form_helpdesk_sale_loyalty', raise_if_not_found=False)
        self.ticket_id.message_post_with_source(
            'helpdesk.ticket_conversion_link',
            render_values={'created_record': coupon, 'message': _('Coupon created')},
            subtype_xmlid='mail.mt_note',
        )
        return {
            'name': _('Coupons'),
            'type': 'ir.actions.act_window',
            'res_model': 'loyalty.card',
            'res_id': coupon.id,
            'view_mode': 'form',
            'view_id': view.id,
            'target': 'new',
        }
