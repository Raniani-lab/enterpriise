# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class AccountMove(models.Model):
    _name = "account.move"
    _inherit = "account.move"

    attachment_ids = fields.One2many('ir.attachment', 'res_id', domain=[('res_model', '=', 'account.move')], string='Attachments')


class AccountInvoice(models.Model):
    _inherit = "account.invoice"

    attachment_ids = fields.One2many('ir.attachment', 'res_id', domain=[('res_model', '=', 'account.invoice')], string='Attachments')


class AccountMoveLine(models.Model):
    _name = "account.move.line"
    _inherit = "account.move.line"

    move_attachment_ids = fields.One2many('ir.attachment', compute='_compute_attachment')

    @api.depends('move_id', 'invoice_id')
    def _compute_attachment(self):
        for record in self:
            record.move_attachment_ids = record.move_id.attachment_ids | record.invoice_id.attachment_ids  # waiting for accountappocalypse
