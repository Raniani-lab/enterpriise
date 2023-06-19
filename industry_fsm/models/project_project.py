# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _


class Project(models.Model):
    _inherit = "project.project"

    is_fsm = fields.Boolean("Field Service", default=False, help="Display tasks in the Field Service module and allow planning with start/end dates.")
    allow_task_dependencies = fields.Boolean(compute='_compute_allow_task_dependencies', store=True, readonly=False)
    allow_worksheets = fields.Boolean(
        "Worksheets", compute="_compute_allow_worksheets", store=True, readonly=False)
    allow_milestones = fields.Boolean(compute='_compute_allow_milestones', store=True, readonly=False)

    @api.depends('is_fsm', 'is_internal_project', 'company_id')
    @api.depends_context('allowed_company_ids')
    def _compute_display_name(self):
        super()._compute_display_name()
        if len(self.env.context.get('allowed_company_ids', [])) <= 1:
            return
        fsm_project_default_name = _("Field Service")
        for project in self:
            if project.is_fsm and project.name == fsm_project_default_name and not project.is_internal_project:
                project.display_name = f'{project.display_name} - {project.company_id.name}'

    @api.depends('is_fsm')
    def _compute_allow_task_dependencies(self):
        has_group = self.user_has_groups('project.group_project_task_dependencies')
        for project in self:
            project.allow_task_dependencies = has_group and not project.is_fsm

    @api.depends('is_fsm')
    def _compute_allow_worksheets(self):
        for project in self:
            project.allow_worksheets = project.is_fsm

    @api.depends('is_fsm')
    def _compute_allow_milestones(self):
        has_group = self.user_has_groups('project.group_project_milestone')
        for project in self:
            project.allow_milestones = has_group and not project.is_fsm

    @api.model
    def default_get(self, fields_list):
        defaults = super().default_get(fields_list)
        if 'allow_task_dependencies' in fields_list:
            defaults['allow_task_dependencies'] = defaults.get('allow_task_dependencies', False) and not defaults.get('is_fsm')
        if 'allow_milestones' in fields_list:
            defaults['allow_milestones'] = defaults.get('allow_milestones', False) and not defaults.get('is_fsm')
        return defaults

    def action_view_fsm_projects_rating(self):
        action = self.env['ir.actions.act_window']._for_xml_id('project.rating_rating_action_project_report')
        action['domain'] = [
            ('parent_res_model', '=', 'project.project'),
            ('consumed', '=', True),
            ('parent_res_id', 'in', self.env['project.project'].search([('is_fsm', '=', True)]).ids)
        ]
        return action

    def action_project_sharing(self):
        action = super().action_project_sharing()
        action['context'].update({
            'fsm_mode': self.is_fsm,
        })
        return action
