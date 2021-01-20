# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from math import ceil

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class HelpdeskTeam(models.Model):
    _inherit = 'helpdesk.team'

    project_id = fields.Many2one("project.project", string="Project", ondelete="restrict", domain="[('allow_timesheets', '=', True), ('company_id', '=', company_id)]",
        help="Project to which the tickets (and the timesheets) will be linked by default.")
    timesheet_timer = fields.Boolean('Timesheet Timer', default=True)
    display_timesheet_timer = fields.Boolean(compute='_compute_display_timesheet_timer')

    @api.depends('use_helpdesk_timesheet')
    def _compute_display_timesheet_timer(self):
        is_uom_hour = self.env.company.timesheet_encode_uom_id == self.env.ref('uom.product_uom_hour')
        for team in self:
            team.display_timesheet_timer = team.use_helpdesk_timesheet and is_uom_hour

    @api.depends('use_helpdesk_timesheet')
    def _compute_timesheet_timer(self):
        for team in self:
            team.timesheet_timer = team.use_helpdesk_timesheet

    def _create_project(self, name, allow_billable, other):
        return self.env['project.project'].create({
            'name': name,
            'type_ids': [
                (0, 0, {'name': _('In Progress')}),
                (0, 0, {'name': _('Closed'), 'is_closed': True})
            ],
            'allow_timesheets': True,
            'allow_timesheet_timer': True,
            **other,
        })

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('use_helpdesk_timesheet') and not vals.get('project_id'):
                allow_billable = vals.get('use_helpdesk_sale_timesheet')
                vals['project_id'] = self._create_project(vals['name'], allow_billable, {}).id
        return super().create(vals_list)

    def write(self, vals):
        if 'use_helpdesk_timesheet' in vals and not vals['use_helpdesk_timesheet']:
            vals['project_id'] = False
        result = super(HelpdeskTeam, self).write(vals)
        for team in self.filtered(lambda team: team.use_helpdesk_timesheet and not team.project_id):
            team.project_id = team._create_project(team.name, team.use_helpdesk_sale_timesheet, {})
        return result


class HelpdeskTicket(models.Model):
    _name = 'helpdesk.ticket'
    _inherit = ['helpdesk.ticket', 'timer.mixin']

    project_id = fields.Many2one("project.project", related="team_id.project_id", readonly=True, store=True)
    timesheet_ids = fields.One2many('account.analytic.line', 'helpdesk_ticket_id', 'Timesheets')
    use_helpdesk_timesheet = fields.Boolean('Timesheet activated on Team', related='team_id.use_helpdesk_timesheet', readonly=True)
    timesheet_timer = fields.Boolean(related='team_id.timesheet_timer')
    display_timesheet_timer = fields.Boolean("Display Timesheet Time", compute='_compute_display_timesheet_timer')
    total_hours_spent = fields.Float(compute='_compute_total_hours_spent', default=0, compute_sudo=True, store=True)
    display_timer_start_secondary = fields.Boolean(compute='_compute_display_timer_buttons')
    display_timer = fields.Boolean(compute='_compute_display_timer')
    encode_uom_in_days = fields.Boolean(compute='_compute_encode_uom_in_days')

    def _compute_encode_uom_in_days(self):
        self.encode_uom_in_days = self.env.company.timesheet_encode_uom_id == self.env.ref('uom.product_uom_day')

    @api.depends('display_timesheet_timer', 'timer_start', 'timer_pause', 'total_hours_spent')
    def _compute_display_timer_buttons(self):
        for ticket in self:
            if not ticket.display_timesheet_timer:
                ticket.update({
                    'display_timer_start_primary': False,
                    'display_timer_start_secondary': False,
                    'display_timer_stop': False,
                    'display_timer_pause': False,
                    'display_timer_resume': False,
                })
            else:
                super(HelpdeskTicket, ticket)._compute_display_timer_buttons()
                ticket.display_timer_start_secondary = ticket.display_timer_start_primary
                if not ticket.timer_start:
                    ticket.update({
                        'display_timer_stop': False,
                        'display_timer_pause': False,
                        'display_timer_resume': False,
                    })
                    if not ticket.total_hours_spent:
                        ticket.display_timer_start_secondary = False
                    else:
                        ticket.display_timer_start_primary = False

    def _compute_display_timer(self):
        if self.env.user.has_group('helpdesk.group_helpdesk_user') and self.env.user.has_group('hr_timesheet.group_hr_timesheet_user'):
            self.display_timer = True
        else:
            self.display_timer = False

    @api.depends('use_helpdesk_timesheet', 'timesheet_timer', 'timesheet_ids', 'encode_uom_in_days')
    def _compute_display_timesheet_timer(self):
        for ticket in self:
            ticket.display_timesheet_timer = ticket.use_helpdesk_timesheet and ticket.timesheet_timer and not ticket.encode_uom_in_days

    @api.depends('timesheet_ids')
    def _compute_total_hours_spent(self):
        for ticket in self:
            ticket.total_hours_spent = round(sum(ticket.timesheet_ids.mapped('unit_amount')), 2)

    @api.model
    def _fields_view_get(self, view_id=None, view_type='form', toolbar=False, submenu=False):
        """ Set the correct label for `unit_amount`, depending on company UoM """
        result = super(HelpdeskTicket, self)._fields_view_get(view_id=view_id, view_type=view_type, toolbar=toolbar, submenu=submenu)
        result['arch'] = self.env['account.analytic.line']._apply_timesheet_label(result['arch'])
        return result

    def action_timer_start(self):
        if not self.user_timer_id.timer_start and self.display_timesheet_timer:
            super().action_timer_start()

    def action_timer_stop(self):
        # timer was either running or paused
        if self.user_timer_id.timer_start and self.display_timesheet_timer:
            minutes_spent = self.user_timer_id._get_minutes_spent()
            minimum_duration = int(self.env['ir.config_parameter'].sudo().get_param('hr_timesheet.timesheet_min_duration', 0))
            rounding = int(self.env['ir.config_parameter'].sudo().get_param('hr_timesheet.timesheet_rounding', 0))
            minutes_spent = self._timer_rounding(minutes_spent, minimum_duration, rounding)
            return self._action_open_new_timesheet(minutes_spent * 60 / 3600)
        return False

    def _action_open_new_timesheet(self, time_spent):
        return {
            "name": _("Confirm Time Spent"),
            "type": 'ir.actions.act_window',
            "res_model": 'helpdesk.ticket.create.timesheet',
            "views": [[False, "form"]],
            "target": 'new',
            "context": {
                **self.env.context,
                'active_id': self.id,
                'active_model': self._name,
                'default_time_spent': time_spent,
            },
        }
