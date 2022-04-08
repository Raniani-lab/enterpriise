# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class ResCompany(models.Model):
    _inherit = "res.company"

    def _create_sign_workflow_data(self):
        mail_documents_activity_to_validate = self.env.ref('documents.mail_documents_activity_data_tv')
        companies = self.filtered(lambda company: company.project_documents_parent_folder)
        self.env['documents.workflow.rule'].sudo().create([{
            'name': 'Sign',
            'sequence': 5,
            'create_model': 'sign.template.direct',
            'condition_type': 'domain',
            'domain': "[('mimetype', 'ilike', 'pdf')]",
            'activity_option': True,
            'activity_type_id': mail_documents_activity_to_validate.id,
            'domain_folder_id': company.project_documents_parent_folder.id,
        } for company in companies])

    def _create_default_project_documents_folder(self):
        super()._create_default_project_documents_folder()
        self._create_sign_workflow_data()
