# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, api, models, _
from odoo.tools.misc import get_lang


class HrAppraisalGoal(models.Model):
    _name = "hr.appraisal.goal"
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _description = "Appraisal Goal"

    name = fields.Char(required=True)
    employee_id = fields.Many2one(
        'hr.employee', string="Employee",
        default=lambda self: self.env.user.employee_id, required=True)
    employee_autocomplete_ids = fields.Many2many('hr.employee', compute='_compute_is_manager')
    company_id = fields.Many2one(related='employee_id.company_id')
    manager_id = fields.Many2one('hr.employee', string="Manager", compute="_compute_manager_id", readonly=False, store=True, required=True)
    manager_user_id = fields.Many2one('res.users', related='manager_id.user_id')
    progression = fields.Selection(selection=[
        ('000', '0%'),
        ('025', '25%'),
        ('050', '50%'),
        ('075', '75%'),
        ('100', '100%')
    ], string="Progress", default="000", tracking=True, required=True)
    description = fields.Html()
    deadline = fields.Date(tracking=True)
    is_manager = fields.Boolean(compute='_compute_is_manager')
    tag_ids = fields.Many2many('hr.appraisal.goal.tag', string="Tags")

    @api.depends_context('uid')
    @api.depends('employee_id')
    def _compute_is_manager(self):
        self.employee_autocomplete_ids = self.env.user.employee_id.employee_autocomplete_ids if self.env.user.employee_id else False
        self.is_manager = self.env.user.has_group('hr_appraisal.group_hr_appraisal_user') or self.employee_autocomplete_ids

    @api.depends('employee_id')
    def _compute_manager_id(self):
        for goal in self:
            goal.manager_id = goal.employee_id.parent_id or self.env.user.employee_id

    def _notify_by_email_prepare_rendering_context(self, message, msg_vals=False, model_description=False,
                                                   force_email_company=False, force_email_lang=False):
        render_context = super()._notify_by_email_prepare_rendering_context(
            message, msg_vals, model_description=model_description,
            force_email_company=force_email_company, force_email_lang=force_email_lang
        )
        if self.deadline:
            render_context['subtitles'].append(
                _('Deadline: %s', self.deadline.strftime(get_lang(self.env).date_format)))
        return render_context

    def action_confirm(self):
        self.write({'progression': '100'})
