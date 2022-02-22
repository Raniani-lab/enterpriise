# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ProjectTask(models.Model):
    _name = 'project.task'
    _inherit = ['project.task', 'documents.mixin']

    document_count = fields.Integer(compute='_compute_attached_document_count', string="Number of documents in Task")

    def _get_task_document_data(self):
        domain = [('res_model', '=', 'project.task'), ('res_id', 'in', self.ids)]
        documents_data = self.env['documents.document']._read_group(domain, ['res_id'], ['res_id'])
        return {document_data['res_id']: document_data['res_id_count'] for document_data in documents_data}

    def _compute_attached_document_count(self):
        tasks_data = self._get_task_document_data()
        for task in self:
            task.document_count = tasks_data.get(task.id, 0)

    def unlink(self):
        # unlink documents.document directly so mail.activity.mixin().unlink is called
        self.env['documents.document'].sudo().search([('attachment_id', 'in', self.attachment_ids.ids)]).unlink()
        return super(ProjectTask, self).unlink()

    def _get_document_tags(self):
        return self.company_id.project_tags

    def _get_document_folder(self):
        return self.company_id.project_folder

    def _check_create_documents(self):
        return self.company_id.documents_project_settings and super()._check_create_documents()
