# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class AccountInvoiceRefund(models.TransientModel):
    _inherit = "account.invoice.refund"

    @api.model
    def _get_reason(self):
        if self.env.context.get('default_ticket_id'):
            return super(AccountInvoiceRefund, self.with_context({'active_id': False}))._get_reason()
        return super(AccountInvoiceRefund, self)._get_reason()

    sale_order_id = fields.Many2one('sale.order', related="ticket_id.sale_order_id", string='Sales Order')
    ticket_id = fields.Many2one('helpdesk.ticket')
    partner_id = fields.Many2one('res.partner', related="ticket_id.partner_id", string="Customer")
    invoice_id = fields.Many2one('account.invoice', string='Invoice To Refund')

    @api.onchange('sale_order_id', 'partner_id')
    def invoice_id_domain(self):
        domain = [('state', 'not in', ['draft', 'canceled']), ('type', '=', 'out_invoice')]
        if self.sale_order_id:
            domain += [('id', 'in', self.sale_order_id.invoice_ids.ids)]
        elif self.partner_id:
            domain += [('partner_id', 'child_of', self.partner_id.commercial_partner_id.id)]
        return {'domain': {'invoice_id': domain}}

    @api.one
    def _get_refund_only(self):
        if self.ticket_id:
            return super(AccountInvoiceRefund, self.with_context({'active_id': self.invoice_id.id}))._get_refund_only()
        return super(AccountInvoiceRefund, self)._get_refund_only()

    @api.multi
    def invoice_refund(self):
        if self.ticket_id:
            res = super(AccountInvoiceRefund, self.with_context({'active_ids': [self.invoice_id.id]})).invoice_refund()
            refund_id = self.env['account.invoice'].search([('refund_invoice_id', '=', self.invoice_id.id), ('date_invoice', '=', self.date_invoice)], order="create_date desc", limit=1)
            self.ticket_id.invoice_ids |= refund_id
            return res
        return super(AccountInvoiceRefund, self).invoice_refund()
