# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class HelpdeskTeam(models.Model):
    _inherit = 'helpdesk.team'

    repairs_count = fields.Integer('Repairs Count', compute='_compute_repairs_count')

    def _compute_repairs_count(self):
        repair_data = self.env['repair.order'].sudo()._read_group([
            ('ticket_id', 'in', self.ticket_ids.ids),
            ('state', 'not in', ['done', 'cancel'])
        ], ['ticket_id'], ['__count'])
        mapped_data = {ticket.id: count for ticket, count in repair_data}
        for team in self:
            team.repairs_count = sum([val for key, val in mapped_data.items() if key in team.ticket_ids.ids])

    def action_view_repairs(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("repair.action_repair_order_tree")
        repair_ids = self.ticket_ids.repair_ids.filtered(lambda x: x.state not in ['done', 'cancel'])
        if len(repair_ids) == 1:
            action.update({
                'view_mode': 'form',
                'res_id': repair_ids.id,
                'views': [(False, 'form')],
            })
        action.update({
            'domain': [('ticket_id', 'in', repair_ids.mapped('ticket_id.id'))],
            'context': {'create': False},
        })
        return action
