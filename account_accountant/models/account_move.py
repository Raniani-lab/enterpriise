# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class AccountMove(models.Model):
    _name = "account.move"
    _inherit = "account.move"

    attachment_ids = fields.One2many('ir.attachment', 'res_id', domain=[('res_model', '=', 'account.move')], string='Attachments')


class AccountMoveLine(models.Model):
    _name = "account.move.line"
    _inherit = "account.move.line"

    move_attachment_ids = fields.One2many(related='move_id.attachment_ids')

