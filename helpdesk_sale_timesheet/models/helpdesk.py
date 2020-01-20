# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.osv import expression

from odoo.addons.sale_timesheet_enterprise.models.sale import DEFAULT_INVOICED_TIMESHEET


class HelpdeskTeam(models.Model):
    _inherit = 'helpdesk.team'

    def _create_project(self, name, allow_billable, other):
        new_values = dict(other, allow_billable=allow_billable)
        return super(HelpdeskTeam, self)._create_project(name, allow_billable, new_values)


class HelpdeskTicket(models.Model):
    _inherit = 'helpdesk.ticket'

    is_overdue = fields.Boolean('Is overdue', compute="_compute_is_overdue",
        help="Indicates more support time has been delivered thant the ordered quantity")
    use_helpdesk_sale_timesheet = fields.Boolean('Reinvoicing Timesheet activated on Team', related='team_id.use_helpdesk_sale_timesheet', readonly=True)

    @api.depends('project_id', 'use_helpdesk_sale_timesheet', 'partner_id.commercial_partner_id')
    def _compute_related_task_ids(self):
        reinvoiced = self.filtered(lambda t: t.project_id and t.use_helpdesk_sale_timesheet and t.partner_id)
        for t in reinvoiced:
            t._related_task_ids = self.env['project.task'].search([
                ('project_id', '=', t.project_id.id),
                '|', ('partner_id', '=', False),
                     ('partner_id', 'child_of', t.partner_id.commercial_partner_id.id)
            ])._origin
        super(HelpdeskTicket, self - reinvoiced)._compute_related_task_ids()

    @api.depends('task_id.sale_line_id')
    def _compute_is_overdue(self):
        for ticket in self:
            if ticket.task_id.sale_line_id:
                sale_line_id = ticket.task_id.sale_line_id
                ticket.is_overdue = sale_line_id.qty_delivered >= sale_line_id.product_uom_qty
            else:
                ticket.is_overdue = False


class AccountAnalyticLine(models.Model):
    _inherit = 'account.analytic.line'

    @api.model
    def _timesheet_preprocess(self, values):
        values = super(AccountAnalyticLine, self)._timesheet_preprocess(values)
        # TODO JEM: clean this. Need to set the SOL when changing the task in order to always have the SOL in project map, or task'SOL or SOL of the project (python constraint)
        if 'task_id' in values and not values.get('so_line'):
            task = self.env['project.task'].sudo().browse(values['task_id'])
            if task.billable_type == 'task_rate':
                values['so_line'] = task.sale_line_id.id
        return values

    def _get_portal_helpdesk_timesheet(self):
        param_invoiced_timesheet = self.env['ir.config_parameter'].sudo().get_param('sale.invoiced_timesheet', DEFAULT_INVOICED_TIMESHEET)
        if param_invoiced_timesheet == 'approved':
            return self.filtered(lambda line: line.validated)
        return self
