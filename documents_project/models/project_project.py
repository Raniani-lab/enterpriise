# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json

from odoo import fields, models, _


class ProjectProject(models.Model):
    _name = 'project.project'
    _inherit = ['project.project', 'documents.mixin']

    document_count = fields.Integer(compute='_compute_attached_document_count', string="Number of documents in Project")

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

    def _get_stat_buttons(self):
        buttons = super(ProjectProject, self)._get_stat_buttons()
        buttons.append({
            'icon': 'file-text-o',
            'text': _('Documents'),
            'number': self.document_count,
            'action_type': 'object',
            'action': 'action_view_documents_project',
            'additional_context': json.dumps({
                'active_id': self.id,
            }),
            'show': True,
            'sequence': 14,
        })
        return buttons

    def action_view_documents_project(self):
        self.ensure_one()
        return {
            'res_model': 'documents.document',
            'type': 'ir.actions.act_window',
            'name': _('Documents'),
            'domain': [
            '|',
                '&',
                ('res_model', '=', 'project.project'), ('res_id', '=', self.id),
                '&',
                ('res_model', '=', 'project.task'), ('res_id', 'in', self.task_ids.ids)
            ],
            'view_mode': 'kanban,tree,form',
            'context': {'default_res_model': 'project.project', 'default_res_id': self.id},
        }

    def _get_document_tags(self):
        return self.company_id.project_tags

    def _get_document_folder(self):
        return self.company_id.project_folder

    def _check_create_documents(self):
        return self.company_id.documents_project_settings and super()._check_create_documents()
