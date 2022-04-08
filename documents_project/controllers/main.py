# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import logging

from odoo import Command, http, SUPERUSER_ID
from odoo.exceptions import AccessError, MissingError
from odoo.http import request

from odoo.addons.documents.controllers.main import ShareRoute

logger = logging.getLogger(__name__)


class DocumentsProjectShareRoute(ShareRoute):
    def _get_task_and_check_access(self, task_id):
        task = request.env['project.task'].browse(task_id)
        task_sudo = task.with_user(SUPERUSER_ID)
        if not task_sudo.exists():
            raise MissingError()

        task.check_access_rights('read')
        task.check_access_rule('read')

        return task_sudo

    def _get_document_and_check_access(self, task_id, document_id=None):
        task_sudo = self._get_task_and_check_access(task_id)
        if not document_id:
            return task_sudo.shared_document_ids

        document = request.env['documents.document'].browse(document_id)
        if document not in task_sudo.shared_document_ids:
            raise request.not_found()
        return document

    @http.route('/my/tasks/<int:task_id>/documents/<int:document_id>/thumbnail', type='http', auth='user')
    def portal_my_task_document_thumbnail(self, task_id, document_id, **kwargs):
        try:
            self._get_document_and_check_access(task_id, document_id)
        except (AccessError, MissingError):
            return request.redirect('/my')

        try:
            return self._get_file_response(document_id, field='thumbnail')
        except Exception:
            return request.not_found()

    @http.route('/my/tasks/<int:task_id>/documents/<int:document_id>/avatar', type='http', auth='user')
    def portal_my_task_document_avatar(self, task_id, document_id, **kwargs):
        try:
            document = self._get_document_and_check_access(task_id, document_id)
        except (AccessError, MissingError):
            return request.redirect('/my')

        user_id = document.owner_id.id
        avatar = request.env['res.users'].sudo().browse(user_id).avatar_128

        if not avatar:
            return request.env['ir.http']._placeholder()
        return base64.b64decode(avatar)

    @http.route('/my/tasks/<int:task_id>/documents/<int:document_id>/download', type='http', auth='user')
    def portal_my_task_documents_download(self, task_id, document_id, **kwargs):
        try:
            self._get_document_and_check_access(task_id, document_id)
        except (AccessError, MissingError):
            return request.redirect('/my')
        return self._get_file_response(document_id)

    @http.route('/my/tasks/<int:task_id>/documents/download', type='http', auth='user')
    def portal_my_task_documents_download_all(self, task_id, **kwargs):
        try:
            documents = self._get_document_and_check_access(task_id)
        except (AccessError, MissingError):
            return request.redirect('/my')

        if not documents:
            raise request.not_found()

        task_name = request.env['project.task'].browse(task_id).name
        return self._make_zip(task_name + '.zip', documents)

    @http.route('/my/tasks/<int:task_id>/documents/upload', type='http', auth='user', methods=['POST'], csrf=False)
    def portal_my_task_document_upload(self, task_id, **kwargs):
        try:
            task_sudo = self._get_task_and_check_access(task_id)
        except (AccessError, MissingError):
            return request.redirect('/my')
        folder = task_sudo.project_id.documents_folder_id

        try:
            for file in request.httprequest.files.getlist('files'):
                data = file.read()
                document_dict = {
                    'mimetype': file.content_type,
                    'name': file.filename,
                    'datas': base64.b64encode(data),
                    'partner_id': request.env.user.partner_id.id,
                    'owner_id': request.env.user.id,
                    'folder_id': folder.id,
                    'tag_ids': [Command.set(task_sudo.project_id.documents_tag_ids)],
                    'res_model': 'project.task',
                    'res_id': task_sudo.id,
                }
                request.env['documents.document'].sudo().create(document_dict)

        except Exception:
            logger.exception("Failed to upload document")

        return request.redirect(f"/my/tasks/{task_id}/documents")
