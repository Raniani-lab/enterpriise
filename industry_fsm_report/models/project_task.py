# Part of Odoo. See LICENSE file for full copyright and licensing details.
from ast import literal_eval

from odoo import api, fields, models, _


class ProjectTask(models.Model):
    _inherit = "project.task"

    worksheet_template_id = fields.Many2one(
        'worksheet.template', string="Worksheet Template",
        compute='_compute_worksheet_template_id', store=True, readonly=False, tracking=True,
        domain="[('res_model', '=', 'project.task'), '|', ('company_ids', '=', False), ('company_ids', 'in', company_id)]",
        group_expand='_group_expand_worksheet_template_id',
        help="Create templates for each type of intervention you have and customize their content with your own custom fields.")
    worksheet_count = fields.Integer(compute='_compute_worksheet_count')
    worksheet_color = fields.Integer(related='worksheet_template_id.color')

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS | {
            'worksheet_count',
            'worksheet_template_id',
        }

    @api.depends('worksheet_count')
    def _compute_display_conditions_count(self):
        super()._compute_display_conditions_count()
        for task in self:
            if task.allow_worksheets and task.worksheet_count:
                task.display_satisfied_conditions_count += 1

    def _hide_sign_button(self):
        self.ensure_one()
        return super()._hide_sign_button() or not self.worksheet_template_id

    @api.depends('worksheet_template_id')
    def _compute_display_sign_report_buttons(self):
        super()._compute_display_sign_report_buttons()

    def _hide_send_report_button(self):
        self.ensure_one()
        return super()._hide_send_report_button() or not self.worksheet_template_id

    @api.depends('worksheet_template_id')
    def _compute_display_send_report_buttons(self):
        super()._compute_display_send_report_buttons()

    @api.depends('project_id')
    def _compute_worksheet_template_id(self):
        # Change worksheet when the project changes, not project.allow_worksheet (YTI To confirm)
        for task in self:
            if not task.worksheet_template_id:
                task.worksheet_template_id = task.parent_id.worksheet_template_id.id\
                    if task.parent_id else task.project_id.worksheet_template_id.id

    @api.depends('worksheet_template_id')
    def _compute_worksheet_count(self):
        is_portal_user = self.env.user.share
        for record in self:
            worksheet_count = 0
            if record.worksheet_template_id:
                Worksheet = self.env[record.worksheet_template_id.sudo().model_id.model]
                if is_portal_user:
                    Worksheet = Worksheet.sudo()
                worksheet_count = Worksheet.search_count([('x_project_task_id', '=', record.id)])
            record.worksheet_count = worksheet_count

    @api.model
    def _group_expand_worksheet_template_id(self, worksheets, domain, order):
        start_date = self._context.get('gantt_start_date')
        scale = self._context.get('gantt_scale')
        if not (start_date and scale):
            return worksheets
        domain = self._expand_domain_dates(domain)
        search_on_comodel = self._search_on_comodel(domain, "worksheet_template_id", "worksheet.template", order)
        if search_on_comodel:
            return search_on_comodel
        else:
            return self.search(domain).worksheet_template_id

    def action_fsm_worksheet(self):
        # We check that comment is not empty, otherwise it means that a `worksheet` has been generated
        # through the use of the mail template in fsm (obviously prior installing industry_fsm_report)
        if not self.worksheet_template_id or self.comment:
            return super().action_fsm_worksheet()
        action = self.worksheet_template_id.action_id.sudo().read()[0]
        worksheet = self.env[self.worksheet_template_id.sudo().model_id.model].search([('x_project_task_id', '=', self.id)])
        context = literal_eval(action.get('context', '{}'))
        action.update({
            'res_id': worksheet.id,
            'views': [(False, 'form')],
            'context': {
                **context,
                'edit': True,
                'default_x_project_task_id': self.id,
            },
        })
        return action

    def _is_fsm_report_available(self):
        self.ensure_one()
        return self.worksheet_count or self.timesheet_ids
