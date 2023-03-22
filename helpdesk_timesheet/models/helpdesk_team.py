# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from collections import defaultdict

from odoo import api, Command, fields, models, _

class HelpdeskTeam(models.Model):
    _inherit = 'helpdesk.team'

    project_id = fields.Many2one("project.project", string="Project", ondelete="restrict", domain="[('allow_timesheets', '=', True), ('company_id', '=', company_id)]",
        help="Project to which the timesheets of this helpdesk team's tickets will be linked.")
    timesheet_encode_uom_id = fields.Many2one('uom.uom', related='company_id.timesheet_encode_uom_id')
    total_timesheet_time = fields.Integer(compute="_compute_total_timesheet_time")

    @api.depends('ticket_ids')
    def _compute_total_timesheet_time(self):
        helpdesk_timesheet_teams = self.filtered('use_helpdesk_timesheet')
        if not helpdesk_timesheet_teams:
            self.total_timesheet_time = 0.0
            return
        timesheets_read_group = self.env['account.analytic.line']._read_group(
            [('helpdesk_ticket_id', 'in', helpdesk_timesheet_teams.ticket_ids.filtered(lambda x: not x.stage_id.fold).ids)],
            ['helpdesk_ticket_id', 'unit_amount', 'product_uom_id'],
            ['helpdesk_ticket_id', 'product_uom_id'],
            lazy=False)
        timesheet_data_dict = defaultdict(list)
        uom_ids = set(helpdesk_timesheet_teams.timesheet_encode_uom_id.ids)
        for result in timesheets_read_group:
            uom_id = result['product_uom_id'] and result['product_uom_id'][0]
            if uom_id:
                uom_ids.add(uom_id)
            timesheet_data_dict[result['helpdesk_ticket_id'][0]].append((uom_id, result['unit_amount']))

        uoms_dict = {uom.id: uom for uom in self.env['uom.uom'].browse(uom_ids)}
        for team in helpdesk_timesheet_teams:
            total_time = sum([
                sum([
                    unit_amount * uoms_dict.get(product_uom_id, team.timesheet_encode_uom_id).factor_inv
                    for product_uom_id, unit_amount in timesheet_data
                ], 0.0)
                for ticket_id, timesheet_data in timesheet_data_dict.items()
                if ticket_id in team.ticket_ids.ids
            ], 0.0)
            total_time *= team.timesheet_encode_uom_id.factor
            team.total_timesheet_time = int(round(total_time))
        (self - helpdesk_timesheet_teams).total_timesheet_time = 0

    def _create_project(self, name, allow_billable, other):
        return self.env['project.project'].create({
            'name': name,
            'type_ids': [
                (0, 0, {'name': _('New')}),
            ],
            'allow_timesheets': True,
            **other,
        })

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('use_helpdesk_timesheet') and not vals.get('project_id'):
                allow_billable = vals.get('use_helpdesk_sale_timesheet')
                vals['project_id'] = self._create_project(vals['name'], allow_billable, {}).id
        teams = super().create(vals_list)
        teams.sudo()._check_timesheet_group()
        return teams

    def write(self, vals):
        if 'use_helpdesk_timesheet' in vals and not vals['use_helpdesk_timesheet']:
            vals['project_id'] = False
            # to unlink timer when use_helpdesk_timesheet is false
            self.env['timer.timer'].search([
                ('res_model', '=', 'helpdesk.ticket'),
                ('res_id', 'in', self.with_context(active_test=False).ticket_ids.ids)
            ]).unlink()
        result = super(HelpdeskTeam, self).write(vals)
        if 'use_helpdesk_timesheet' in vals:
            self.sudo()._check_timesheet_group()
        for team in self.filtered(lambda team: team.use_helpdesk_timesheet and not team.project_id):
            team.project_id = team._create_project(team.name, team.use_helpdesk_sale_timesheet, {})
        return result

    def _get_timesheet_user_group(self):
        return self.env.ref('hr_timesheet.group_hr_timesheet_user')

    def _check_timesheet_group(self):
        timesheet_teams = self.filtered('use_helpdesk_timesheet')
        use_helpdesk_timesheet_group = self.user_has_groups('helpdesk_timesheet.group_use_helpdesk_timesheet')
        helpdesk_timesheet_group = self.env.ref('helpdesk_timesheet.group_use_helpdesk_timesheet')
        enabled_timesheet_team = lambda: self.env['helpdesk.team'].search([('use_helpdesk_timesheet', '=', True)], limit=1)
        if timesheet_teams and not use_helpdesk_timesheet_group:
            (self._get_helpdesk_user_group() + self._get_timesheet_user_group())\
                .write({'implied_ids': [Command.link(helpdesk_timesheet_group.id)]})
        elif self - timesheet_teams and use_helpdesk_timesheet_group and not enabled_timesheet_team():
            (self._get_helpdesk_user_group() + self._get_timesheet_user_group())\
                .write({'implied_ids': [Command.unlink(helpdesk_timesheet_group.id)]})
            helpdesk_timesheet_group.write({'users': [Command.clear()]})

    def action_view_timesheets(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("helpdesk_timesheet.act_hr_timesheet_line_helpdesk")
        action.update({
            'domain': [('helpdesk_ticket_id', 'in', self.ticket_ids.filtered(lambda x: not x.stage_id.fold).ids)],
            'context': {
                'default_project_id': self.project_id.id,
                'graph_groupbys': ['date:week', 'employee_id'],
            },
        })
        return action
