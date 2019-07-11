# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class Project(models.Model):
    _inherit = "project.project"

    @api.model
    def default_get(self, fields):
        """ Pre-fill data "Default Worksheet" as default when creating new projects allowing worksheets
            if no other worksheet set.
        """
        result = super(Project, self).default_get(fields)
        if 'worksheet_template_id' in fields and result.get('allow_worksheets') and not result.get('worksheet_template_id'):
            default_worksheet = self.env.ref('industry_fsm_report.fsm_worksheet_template', False)
            if default_worksheet:
                result['worksheet_template_id'] = default_worksheet.id
        return result

    allow_worksheets = fields.Boolean("Allow Worksheets", help="Enables customizable worksheets on tasks.")
    worksheet_template_id = fields.Many2one(
        'project.worksheet.template',
        string="Default Worksheet",
        help="Choose a default worksheet template for this project (you can change it individually on each task).")


class Task(models.Model):
    _inherit = "project.task"

    @api.model
    def default_get(self, fields):
        result = super(Task, self).default_get(fields)
        default_project_id = self.env.context.get('default_project_id')
        if default_project_id:
            project = self.env['project.project'].browse(default_project_id)
            if 'report_template_id' in fields:
                result['report_template_id'] = project.report_template_id.id
        return result

    allow_worksheets = fields.Boolean(related='project_id.allow_worksheets', oldname='allow_reports')
    worksheet_template_id = fields.Many2one('project.worksheet.template', string="Worksheet Template", oldname='report_template_id')
    worksheet_count = fields.Integer(compute='_compute_worksheet_count')
    fsm_is_sent = fields.Boolean('Is Worksheet sent', readonly=True)

    @api.onchange('project_id')
    def _onchange_project_id(self):
        if self.project_id.allow_worksheets:
            self.worksheet_template_id = self.project_id.worksheet_template_id.id
        else:
            self.worksheet_template_id = False

    @api.depends('worksheet_template_id')
    def _compute_worksheet_count(self):
        if self.worksheet_template_id:
            self.worksheet_count = self.env[self.worksheet_template_id.model_id.model].search_count([('x_task_id', '=', self.id)])

    def action_fsm_worksheet(self):
        timesheet_access = self.env['account.analytic.line'].check_access_rights('create', raise_exception=False)
        if timesheet_access and self.company_id.use_timesheet_timer and (self.allow_timesheets and self.allow_planning) and not (self.timesheet_ids or self.timesheet_timer_start):
            raise UserError(_("Please, start the timer before recording the worksheet."))
        action = self.worksheet_template_id.action_id.read()[0]
        worksheet = self.env[self.worksheet_template_id.model_id.model].search([('x_task_id', '=', self.id)])
        action.update({
            'res_id': worksheet.id if worksheet else False,
            'views': [(False, 'form')],
            'context': {
                'default_x_task_id': self.id,
                'form_view_initial_mode': 'edit',
                'create': False,
            },
        })
        return action

    def action_send_report(self):
        self.ensure_one()
        if self.worksheet_template_id and not self.worksheet_count:
            raise UserError(_("To send the report, you need to set a worksheet template and create a worksheet."))

        template_id = self.env.ref('industry_fsm_report.mail_template_data_send_report').id
        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'mail.compose.message',
            'views': [(False, 'form')],
            'view_id': False,
            'target': 'new',
            'context': {
                'default_model': 'project.task',
                'default_res_id': self.id,
                'default_use_template': bool(template_id),
                'default_template_id': template_id,
                'model_description': self._name,
                'fsm_mark_as_sent': True,
            },
        }

    # ---------------------------------------------------------
    # Business Methods
    # ---------------------------------------------------------

    def _message_post_after_hook(self, message, *args, **kwargs):
        if self.env.context.get('fsm_mark_as_sent') and not self.fsm_is_sent:
            self.write({'fsm_is_sent': True})
