# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
from collections import defaultdict

from odoo import api, fields, models, _, _lt
from odoo.exceptions import UserError


class ProjectProject(models.Model):
    _name = 'project.project'
    _inherit = ['project.project', 'documents.mixin']

    company_use_documents = fields.Boolean("Company Documents Setting", related='company_id.project_use_documents')
    use_documents = fields.Boolean("Use Documents", default=lambda self: self.env.company.project_use_documents)
    documents_folder_id = fields.Many2one('documents.folder', string="Workspace", domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]",
        help="Workspace in which all of the documents of this project will be categorized. All of the attachments of your tasks will be automatically added as documents in this workspace as well.")
    documents_tag_ids = fields.Many2many('documents.tag', 'project_documents_tag_rel', string="Default Tags", domain="[('folder_id', 'parent_of', documents_folder_id)]",
        help="Tags that will be set by default on all of the new documents of your project.")
    document_count = fields.Integer(compute='_compute_attached_document_count', string="Number of documents in Project", groups='documents.group_documents_user')

    @api.constrains('documents_folder_id')
    def _check_company_is_folder_company(self):
        for project in self:
            if project.documents_folder_id and project.documents_folder_id.company_id and project.company_id != project.documents_folder_id.company_id:
                raise UserError(_('The "%s" workspace should either be in the "%s" company like this project or be open to all companies.', project.documents_folder_id.name, project.company_id.name))

    def _compute_attached_document_count(self):
        Task = self.env['project.task']
        task_read_group = Task._read_group(
            [('project_id', 'in', self.ids)],
            ['project_id', 'ids:array_agg(id)'],
            ['project_id'],
        )
        task_ids = []
        task_ids_per_project_id = {}
        for res in task_read_group:
            task_ids += res['ids']
            task_ids_per_project_id[res['project_id'][0]] = res['ids']
        Document = self.env['documents.document']
        project_document_read_group = Document._read_group(
            [('res_model', '=', 'project.project'), ('res_id', 'in', self.ids)],
            ['res_id'],
            ['res_id'],
        )
        document_count_per_project_id = {res['res_id']: res['res_id_count'] for res in project_document_read_group}
        document_count_per_task_id = Task.browse(task_ids)._get_task_document_data()
        for project in self:
            task_ids = task_ids_per_project_id.get(self.id, [])
            project.document_count = document_count_per_project_id.get(self.id, 0) \
                + sum([
                    document_count
                    for task_id, document_count in document_count_per_task_id.items()
                    if task_id in task_ids
                ])

    @api.onchange('documents_folder_id')
    def _onchange_documents_folder_id(self):
        self.env['documents.document'].search([
            ('res_model', '=', 'project.task'),
            ('res_id', 'in', self.task_ids.ids),
            ('folder_id', '=', self._origin.documents_folder_id.id),
        ]).folder_id = self.documents_folder_id
        self.documents_tag_ids = False

    @api.model_create_multi
    def create(self, vals_list):
        folders_to_create_vals = []
        vals_indexes_with_folder_to_create = []
        copied_folder_ids_per_company_id = defaultdict(list)

        for index, vals in enumerate(vals_list):
            if (('use_documents' in vals and vals['use_documents']) or (self.env.company.project_use_documents and not 'use_documents' in vals)) and not vals.get('documents_folder_id'):
                company = self.env['res.company'].browse(vals['company_id']) if vals.get('company_id') else self.env.company
                folder_vals = {
                    'name': vals['name'],
                    'parent_folder_id': company.project_documents_parent_folder.id,
                    'company_id': company.id,
                }
                if company.project_documents_template_folder:
                    copied_folder = company.project_documents_template_folder.copy(folder_vals)
                    copied_folder_ids_per_company_id[company.id].append(copied_folder.id)
                    vals['documents_folder_id'] = copied_folder.id
                else:
                    folders_to_create_vals.append(folder_vals)
                    vals_indexes_with_folder_to_create.append(index)

        for company_id, folder_ids in copied_folder_ids_per_company_id.items():
            self.env['documents.folder'].search([('id', 'child_of', folder_ids)]).write({'company_id': company_id})

        created_folders = self.env['documents.folder'].create(folders_to_create_vals)
        for index, folder in zip(vals_indexes_with_folder_to_create, created_folders):
            vals_list[index]['documents_folder_id'] = folder.id
        return super().create(vals_list)

    def write(self, vals):
        if 'company_id' in vals:
            for project in self:
                if project.documents_folder_id and project.documents_folder_id.company_id and len(project.documents_folder_id.project_ids) > 1:
                    other_projects = project.documents_folder_id.project_ids - self
                    if other_projects and other_projects.company_id.id != vals['company_id']:
                        lines = [f"- {project.name}" for project in other_projects]
                        raise UserError(_(
                            'You cannot change the company of this project, because its workspace is linked to the other following projects that are still in the "%s" company:\n%s\n\n'
                            'Please update the company of all projects so that they remain in the same company as their workspace, or leave the company of the "%s" workspace blank.',
                            other_projects.company_id.name, '\n'.join(lines), project.documents_folder_id.name))

        res = super().write(vals)
        if 'company_id' in vals:
            for project in self:
                if project.documents_folder_id and project.documents_folder_id.company_id:
                    project.documents_folder_id.company_id = project.company_id

        if vals.get('use_documents'):
            folders_to_create_vals = []
            projects_with_folder_to_create = []
            copied_folder_ids_per_company_id = defaultdict(list)

            for project in self:
                if not project.documents_folder_id:
                    folder_vals = {
                        'name': project.name,
                        'parent_folder_id': project.company_id.project_documents_parent_folder.id,
                        'company_id': project.company_id.id,
                    }
                    if project.company_id.project_documents_template_folder:
                        copied_folder = project.company_id.project_documents_template_folder.copy(folder_vals)
                        copied_folder_ids_per_company_id[project.company_id.id].append(copied_folder.id)
                        project.documents_folder_id = copied_folder.id
                    else:
                        folders_to_create_vals.append(folder_vals)
                        projects_with_folder_to_create.append(project)

            for company_id, folder_ids in copied_folder_ids_per_company_id.items():
                self.env['documents.folder'].search([('id', 'child_of', folder_ids)]).write({'company_id': company_id})

            created_folders = self.env['documents.folder'].create(folders_to_create_vals)
            for project, folder in zip(projects_with_folder_to_create, created_folders):
                project.documents_folder_id = folder.id
        return res

    def _get_stat_buttons(self):
        buttons = super(ProjectProject, self)._get_stat_buttons()
        if self.use_documents:
            buttons.append({
                'icon': 'file-text-o',
                'text': _lt('Documents'),
                'number': self.document_count,
                'action_type': 'object',
                'action': 'action_view_documents_project',
                'additional_context': json.dumps({
                    'active_id': self.id,
                }),
                'show': self.use_documents,
                'sequence': 14,
            })
        return buttons

    def action_view_documents_project(self):
        self.ensure_one()
        return {
            'res_model': 'documents.document',
            'type': 'ir.actions.act_window',
            'name': _("%s's Documents", self.name),
            'domain': [
            '|',
                '&',
                ('res_model', '=', 'project.project'), ('res_id', '=', self.id),
                '&',
                ('res_model', '=', 'project.task'), ('res_id', 'in', self.task_ids.ids)
            ],
            'view_mode': 'kanban,tree,form',
            'context': {'default_res_model': 'project.project', 'default_res_id': self.id, 'limit_folders_to_project': True},
        }

    def _get_document_tags(self):
        return self.documents_tag_ids

    def _get_document_folder(self):
        return self.documents_folder_id

    def _check_create_documents(self):
        return self.use_documents and super()._check_create_documents()
