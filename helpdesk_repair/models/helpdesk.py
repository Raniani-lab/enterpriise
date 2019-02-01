# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class HelpdeskTicket(models.Model):
    _inherit = 'helpdesk.ticket'

    repairs_count = fields.Integer('Repairs Count', compute='_compute_repairs_count')
    repair_ids = fields.One2many('repair.order', 'ticket_id', string='Repairs')

    @api.depends('repair_ids')
    @api.multi
    def _compute_repairs_count(self):
        for ticket in self:
            ticket.repairs_count = len(ticket.repair_ids)

    @api.multi
    def open_repairs(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Repairs'),
            'res_model': 'repair.order',
            'view_mode': 'tree,form',
            'domain': [('id', 'in', self.repair_ids.ids)],
        }
