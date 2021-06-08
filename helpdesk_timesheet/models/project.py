# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class Project(models.Model):
    _inherit = 'project.project'

    ticket_ids = fields.One2many('helpdesk.ticket', 'project_id', string='Tickets')
    ticket_count = fields.Integer('# Tickets', compute='_compute_ticket_count')

    helpdesk_team = fields.One2many('helpdesk.team', 'project_id')
    has_helpdesk_team = fields.Boolean('Has Helpdesk Teams', compute='_compute_has_helpdesk_team', compute_sudo=True)

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

    @api.depends('helpdesk_team.project_id')
    def _compute_has_helpdesk_team(self):
        result = self.env['helpdesk.team'].read_group([
            ('project_id', 'in', self.ids)
        ], ['project_id'], ['project_id'])
        data = {data['project_id'][0]: data['project_id_count'] > 0 for data in result}
        for project in self:
            project.has_helpdesk_team = data.get(project.id, False)

    @api.depends('helpdesk_team.use_helpdesk_timesheet')
    def _compute_allow_timesheet_timer(self):
        super(Project, self)._compute_allow_timesheet_timer()

        for project in self:
            project.allow_timesheet_timer = project.allow_timesheet_timer or project.helpdesk_team.use_helpdesk_timesheet
