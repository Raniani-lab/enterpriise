# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class Project(models.Model):
    _inherit = "project.project"

    allow_reports = fields.Boolean("Allow Reports")
    report_template_id = fields.Many2one('project.report.template', string="Default Report")


class Task(models.Model):
    _inherit = "project.task"

    @api.model
    def default_get(self, fields):
        result = super(Task, self).default_get(fields)
        project_id = self.env['project.project'].browse([self._context.get('default_project_id')])
        if 'report_template_id' in fields and project_id:
            result['report_template_id'] = project_id.report_template_id.id
        return result

    allow_reports = fields.Boolean(related='project_id.allow_reports')
    report_template_id = fields.Many2one('project.report.template', string="Report Template")
    report_count = fields.Integer(compute='_compute_report_count')

    def _compute_report_count(self):
        if self.report_template_id:
            self.report_count = self.env[self.report_template_id.model_id.model].search_count([('x_task_id', '=', self.id)])

    def create_or_view_report(self):
        if (self.allow_timesheets and self.allow_planning) and not self.timesheet_ids:
            raise UserError(_("You haven't started this task yet!"))
        action = self.report_template_id.action_id.read()[0]
        report = self.env[self.report_template_id.model_id.model].search([('x_task_id', '=', self.id)])
        action.update({
            'res_id': report.id if report else False,
            'views': [(False, 'form')],
            'context': {
                'default_x_task_id': self.id,
                'default_x_name': self.name,
                'form_view_initial_mode': 'edit'
            },
        })
        return action

    def action_set_done(self):
        for record in self:
            if record.report_template_id and not record.report_count:
                raise UserError(_("The report is not filled!."))
        return super(Task, self).action_set_done()


class ProjectReportTemplate(models.Model):
    _name = 'project.report.template'
    _description = 'Project Report Template'

    name = fields.Char(string='Name', required=True)
    sequence = fields.Integer()
    report_count = fields.Integer(compute='_compute_report_count')
    model_id = fields.Many2one('ir.model', ondelete='cascade')
    action_id = fields.Many2one('ir.actions.act_window')
    active = fields.Boolean(default=True)

    def _compute_report_count(self):
        # TODO: use a read_group to speed up performances
        for record in self:
            if record.model_id:
                record.report_count = self.env[record.model_id.model].search_count([])

    @api.model
    def create(self, vals):
        report = super(ProjectReportTemplate, self).create(vals)
        name = 'x_project_report_template_' + str(report.id)
        model = self.env['ir.model'].create({'name': vals['name'], 'model': name})
        self.env['ir.model.access'].create({
            'name': name + '_access',
            'model_id': model.id,
            'group_id': self.env.ref('project.group_project_user').id,
            'perm_create': True,
            'perm_write': True,
            'perm_read': True,
            'perm_unlink': True,
        })
        self.env['ir.model.fields'].create({
            'model_id': model.id,
            'field_description': 'Task',
            'name': 'x_task_id',
            'relation': 'project.task',
            'required': True,
            'on_delete': 'cascade',
            'model': model.model,
            'ttype': 'many2one',
            })
        self.env['ir.ui.view'].create({
            'type': 'form',
            'model': model.model,
            'arch': """
            <form>
                <sheet>
                    <group>
                        <group>
                            <field name="x_task_id" invisible="context.get('studio') or context.get('default_x_task_id')" readonly="context.get('default_x_task_id')"/>
                            <field name="x_name" invisible="True"/>
                        </group>
                        <group>
                        </group>
                    </group>
                </sheet>
            </form>
            """
        })
        action = self.env['ir.actions.act_window'].create({
            'name': 'Project Template : ' + report.name,
            'res_model': model.model,
            'view_type': 'form',
            'view_mode': 'tree,form',
            'target': 'current',
        })
        report.write({
            'action_id': action.id,
            'model_id': model.id,
        })
        return report

    def action_view_reports(self):
        return self.action_id.read()[0]

    def get_x_model_form_action(self):
        action = self.action_id.read()[0]
        action.update({
            'views': [[False, "form"]],
            'context': {'default_x_task_id': True,
                        'default_x_name': 'Example report'}
        })
        return action
