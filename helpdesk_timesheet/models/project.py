# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class Project(models.Model):
    _inherit = 'project.project'

    ticket_ids = fields.One2many('helpdesk.ticket', 'project_id', string='Tickets')
    ticket_count = fields.Integer('# Tickets', compute='_compute_ticket_count')

    helpdesk_team = fields.One2many('helpdesk.team', 'project_id')
    allow_timesheet_timer = fields.Boolean(compute = '_compute_allow_timesheet_timer', store = True, readonly = False)

    @api.depends('ticket_ids.project_id')
    def _compute_ticket_count(self):
        if not self.user_has_groups('helpdesk.group_helpdesk_user'):
            self.ticket_count = 0
            return
        result = self.env['helpdesk.ticket'].read_group([
            ('project_id', 'in', self.ids)
        ], ['project_id'], ['project_id'])
        data = {data['project_id'][0]: data['project_id_count'] for data in result}
        for project in self:
            project.ticket_count = data.get(project.id, 0)

    @api.depends('helpdesk_team.timesheet_timer')
    def _compute_allow_timesheet_timer(self):
        for team in self:
            team.allow_timesheet_timer = team.helpdesk_team.timesheet_timer
