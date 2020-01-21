# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from ast import literal_eval

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

    allow_worksheets = fields.Boolean("Worksheets", help="Enables customizable worksheets on tasks.")
    worksheet_template_id = fields.Many2one(
        'project.worksheet.template',
        string="Default Worksheet",
        help="Choose a default worksheet template for this project (you can change it individually on each task).",
        domain="['|', ('company_ids', '=', False), ('company_ids', 'in', company_id)]")

    @api.onchange('allow_worksheets')
    def _onchange_allow_worksheets(self):
        if self.allow_worksheets:
            default_worksheet = self.env.ref('industry_fsm_report.fsm_worksheet_template', False)
            if default_worksheet:
                self.worksheet_template_id = default_worksheet.id
        else:
            self.worksheet_template_id = False


class Task(models.Model):
    _inherit = "project.task"

    def _default_worksheet_template_id(self):
        default_project_id = self.env['project.task'].default_get(['project_id']).get('project_id')
        if default_project_id:
            project = self.env['project.project'].browse(default_project_id)
            return project.worksheet_template_id
        return False

    allow_worksheets = fields.Boolean(related='project_id.allow_worksheets', default=False)
    worksheet_template_id = fields.Many2one(
        'project.worksheet.template', string="Worksheet Template",
        default=_default_worksheet_template_id,
        domain="['|', ('company_ids', '=', False), ('company_ids', 'in', company_id)]")
    worksheet_count = fields.Integer(compute='_compute_worksheet_count')
    fsm_is_sent = fields.Boolean('Is Worksheet sent', readonly=True)
    worksheet_signature = fields.Binary('Signature', help='Signature received through the portal.', copy=False, attachment=True)
    worksheet_signed_by = fields.Char('Signed By', help='Name of the person that signed the task.', copy=False)
    worksheet_color = fields.Integer(related='worksheet_template_id.color')
    display_sign_report_primary = fields.Boolean(compute='_compute_display_sign_report_buttons')
    display_sign_report_secondary = fields.Boolean(compute='_compute_display_sign_report_buttons')
    display_send_report_primary = fields.Boolean(compute='_compute_display_send_report_buttons')
    display_send_report_secondary = fields.Boolean(compute='_compute_display_send_report_buttons')

    @api.depends('allow_worksheets', 'worksheet_count')
    def _compute_display_conditions_count(self):
        super(Task, self)._compute_display_conditions_count()
        for task in self:
            enabled = task.display_enabled_conditions_count
            satisfied = task.display_satisfied_conditions_count
            enabled += 1 if task.allow_worksheets else 0
            satisfied += 1 if task.allow_worksheets and task.worksheet_count else 0
            task.write({
                'display_enabled_conditions_count': enabled,
                'display_satisfied_conditions_count': satisfied
            })

    @api.depends(
        'allow_worksheets', 'timer_start', 'worksheet_signature', 'worksheet_template_id',
        'display_satisfied_conditions_count', 'display_enabled_conditions_count')
    def _compute_display_sign_report_buttons(self):
        for task in self:
            sign_p, sign_s = True, True
            if not task.allow_worksheets or task.timer_start or \
                    task.worksheet_signature or not task.worksheet_template_id or \
                    not task.display_satisfied_conditions_count:
                sign_p, sign_s = False, False
            else:
                if task.display_enabled_conditions_count == task.display_satisfied_conditions_count:
                    sign_s = False
                else:
                    sign_p = False
            task.write({
                'display_sign_report_primary': sign_p,
                'display_sign_report_secondary': sign_s,
            })

    @api.depends(
        'allow_worksheets', 'timer_start', 'worksheet_signature', 'worksheet_template_id',
        'display_satisfied_conditions_count', 'display_satisfied_conditions_count',
        'fsm_is_sent')
    def _compute_display_send_report_buttons(self):
        for task in self:
            send_p, send_s = True, True
            if not task.allow_worksheets or task.timer_start or \
                    not task.worksheet_signature or not task.worksheet_template_id or \
                    not task.display_satisfied_conditions_count:
                send_p, send_s = False, False
            else:
                if task.display_enabled_conditions_count == task.display_satisfied_conditions_count \
                        and not task.fsm_is_sent:
                    send_s = False
                else:
                    send_p = False
            task.write({
                'display_send_report_primary': send_p,
                'display_send_report_secondary': send_s,
            })

    @api.onchange('project_id')
    def _onchange_project_id(self):
        if self.project_id.allow_worksheets:
            self.worksheet_template_id = self.project_id.worksheet_template_id.id
        else:
            self.worksheet_template_id = False

    @api.depends('worksheet_template_id')
    def _compute_worksheet_count(self):
        self.worksheet_count = self.worksheet_template_id and self.env[self.worksheet_template_id.model_id.model].search_count([('x_task_id', '=', self.id)]) or 0

    def has_to_be_signed(self):
        return self.allow_worksheets and not self.worksheet_signature

    def action_fsm_worksheet(self):
        action = self.worksheet_template_id.action_id.read()[0]
        worksheet = self.env[self.worksheet_template_id.model_id.model].search([('x_task_id', '=', self.id)])
        context = literal_eval(action.get('context', '{}'))
        action.update({
            'res_id': worksheet.id if worksheet else False,
            'views': [(False, 'form')],
            'context': {
                **context,
                'edit': True,
                'default_x_task_id': self.id,
                'form_view_initial_mode': 'edit',
            },
        })
        return action

    def action_preview_worksheet(self):
        self.ensure_one()
        if not self.worksheet_template_id:
            raise UserError(_("To send the report, you need to select a worksheet template."))

        source = 'fsm' if self.env.context.get('fsm_mode', False) else 'project'
        return {
            'type': 'ir.actions.act_url',
            'target': 'self',
            'url': self.get_portal_url(suffix='/worksheet/%s' % source)
        }

    def _get_report_base_filename(self):
        self.ensure_one()
        return 'Worksheet %s - %s' % (self.name, self.partner_id.name)

    def action_send_report(self):
        self.ensure_one()
        if not self.worksheet_template_id:
            raise UserError(_("To send the report, you need to select a worksheet template."))

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
                'force_email': True,
                'fsm_mark_as_sent': True,
            },
        }

    # ---------------------------------------------------------
    # Business Methods
    # ---------------------------------------------------------

    def _message_post_after_hook(self, message, *args, **kwargs):
        if self.env.context.get('fsm_mark_as_sent') and not self.fsm_is_sent:
            self.write({'fsm_is_sent': True})
