# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class AccountMove(models.Model):
    _inherit = "account.move"

    attachment_ids = fields.One2many('ir.attachment', 'res_id', domain=[('res_model', '=', 'account.move')], string='Attachments')

    def action_open_matching_suspense_moves(self):
        self.ensure_one()
        domain = self._get_domain_matching_suspense_moves()
        ids = self.env['account.move.line'].search(domain).mapped('statement_line_id').ids
        action_context = {'show_mode_selector': False, 'company_ids': self.mapped('company_id').ids}
        action_context.update({'suspense_moves_mode': True})
        action_context.update({'statement_line_ids': ids})
        action_context.update({'partner_id': self.partner_id.id})
        action_context.update({'partner_name': self.partner_id.name})
        return {
            'type': 'ir.actions.client',
            'tag': 'bank_statement_reconciliation_view',
            'context': action_context,
        }


class AccountPayment(models.Model):
    _inherit = "account.payment"

    attachment_ids = fields.One2many('ir.attachment', 'res_id', domain=[('res_model', '=', 'account.payment')], string='Attachments')


class AccountBankStatement(models.Model):
    _inherit = "account.bank.statement"

    attachment_ids = fields.One2many('ir.attachment', 'res_id', domain=[('res_model', '=', 'account.bank.statement')], string='Attachments')


class AccountMoveLine(models.Model):
    _name = "account.move.line"
    _inherit = "account.move.line"

    move_attachment_ids = fields.One2many('ir.attachment', compute='_compute_attachment')

    @api.depends('move_id', 'payment_id')
    def _compute_attachment(self):
        for record in self:
            record.move_attachment_ids = record.move_id.attachment_ids + record.statement_id.attachment_ids + record.payment_id.attachment_ids
