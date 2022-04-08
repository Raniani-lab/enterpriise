# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.exceptions import AccessError, MissingError
from odoo.http import request

from odoo.addons.project.controllers.portal import ProjectCustomerPortal


class DocumentsProjectCustomerPortal(ProjectCustomerPortal):
    @http.route('/my/tasks/<int:task_id>/documents', type='http', auth='user')
    def portal_my_task_documents(self, task_id, **kwargs):
        try:
            task_sudo = self._document_check_access('project.task', task_id)
        except (AccessError, MissingError):
            return request.redirect('/my')

        available_documents = task_sudo.shared_document_ids
        if not available_documents:
            return request.not_found()

        options = {
            'base_url': f"/my/tasks/{task_id}/documents/",
            'upload': task_sudo.documents_folder_id.is_shared,
            'document_ids': available_documents,
            'all_button': len(available_documents) > 1 and 'binary' in [document.type for document in available_documents],
        }
        return request.render('documents_project.share_page', options)
