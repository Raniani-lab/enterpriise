# -*- coding: utf-8 -*-

import base64
import zipfile
import io
import logging
import os

from ast import literal_eval

from odoo import http, fields, models
from odoo.exceptions import AccessError
from odoo.http import request, content_disposition
from odoo.osv import expression
from odoo.tools import pycompat, consteq, limited_image_resize
logger = logging.getLogger(__name__)


class ShareRoute(http.Controller):

    # util methods #################################################################################

    def _neuter_mimetype(self, mimetype, user):
        wrong_type = 'ht' in mimetype or 'xml' in mimetype or 'svg' in mimetype
        if wrong_type and not user._is_system():
            return 'text/plain'
        return mimetype

    def binary_content(self, id, env=None, field='datas', share_id=None, share_token=None,
                       download=False, unique=False, filename_field='name'):
        env = env or request.env
        record = env['documents.document'].browse(int(id))
        filehash = None

        if share_id:
            share = env['documents.share'].sudo().browse(int(share_id))
            if (not share.exists() or
                    share.state == 'expired' or
                    not share_token or
                    not consteq(share_token, share.access_token)):
                return (404, [], None)
            elif share.type == 'ids' and (id in share.document_ids.ids):
                record = env['documents.document'].sudo().browse(int(id))
            elif share.type == 'domain':
                record = env['documents.document'].sudo().browse(int(id))
                share_domain = []
                if share.domain:
                    share_domain = literal_eval(share.domain)
                domain = expression.AND([[('folder_id', '=', share.folder_id.id), ('id', '=', id)], share_domain])
                document_check = http.request.env['documents.document'].sudo().search(domain)
                if not document_check:
                    return (404, [], None)

        #check access right
        try:
            last_update = record['__last_update']
        except AccessError:
            return (404, [], None)

        mimetype = False
        if record._name == 'documents.document' and record.type == 'url' and record.url:
            module_resource_path = record.url
            filename = os.path.basename(module_resource_path)
            status = 301
            content = module_resource_path
        else:
            status, content, filename, mimetype, filehash = env['ir.http']._binary_record_content(
                record, field=field, filename=None, filename_field=filename_field,
                default_mimetype='application/octet-stream')
        status, headers, content = env['ir.http']._binary_set_headers(
            status, content, filename, mimetype, unique, filehash=filehash, download=download)

        return status, headers, content

    def _get_file_response(self, id, field='datas', share_id=None, share_token=None):
        """
        returns the http response to download one file.

        """

        status, headers, content = self.binary_content(
            id, field=field, share_id=share_id, share_token=share_token, download=True)

        if status != 200:
            return request.env['ir.http']._response_by_status(status, headers, content)
        else:
            content_base64 = base64.b64decode(content)
            headers.append(('Content-Length', len(content_base64)))
            response = request.make_response(content_base64, headers)

        return response

    def _make_zip(self, name, documents):
        """returns zip files for the Document Inspector and the portal.

        :param name: the name to give to the zip file.
        :param documents: files (documents.document) to be zipped.
        :return: a http response to download a zip file.
        """
        stream = io.BytesIO()
        try:
            with zipfile.ZipFile(stream, 'w') as doc_zip:
                for document in documents:
                    if document.type != 'binary':
                        continue
                    filename = document.datas_fname
                    doc_zip.writestr(filename, base64.b64decode(document['datas']),
                                     compress_type=zipfile.ZIP_DEFLATED)
        except zipfile.BadZipfile:
            logger.exception("BadZipfile exception")

        content = stream.getvalue()
        headers = [
            ('Content-Type', 'zip'),
            ('X-Content-Type-Options', 'nosniff'),
            ('Content-Length', len(content)),
            ('Content-Disposition', content_disposition(name))
        ]
        return request.make_response(content, headers)

    # Download & upload routes #####################################################################

    @http.route(['/documents/content/<int:id>'], type='http', auth='user')
    def documents_content(self, id, share_token=None, share_id=None):
        return self._get_file_response(id, share_id=share_id, share_token=share_token)

    @http.route(['/documents/image/<int:id>',
                 '/documents/image/<int:id>/<int:width>x<int:height>',
                 ], type='http', auth="public")
    def content_image(self, id=None, field='datas', share_id=None, width=0, height=0, crop=False, share_token=None,
                      avoid_if_small=False, upper_limit=False, **kw):
        status, headers, content = self.binary_content(
             id=id, field=field, share_id=share_id, share_token=share_token)
        if status != 200:
            return request.env['ir.http']._response_by_status(status, headers, content)

        content = limited_image_resize(
            content, width=width, height=height, crop=crop, upper_limit=upper_limit, avoid_if_small=avoid_if_small)

        if content:
            image_base64 = base64.b64decode(content)
        else:
            return request.not_found()

        headers.append(('Content-Length', len(image_base64)))
        response = request.make_response(image_base64, headers)
        response.status_code = status
        return response

    @http.route(['/document/zip'], type='http', auth='user')
    def get_zip(self, file_ids, zip_name, token=None):
        """route to get the zip file of the selection in the document's Kanban view (Document inspector).
        :param file_ids: if of the files to zip.
        :param zip_name: name of the zip file.
        """
        ids_list = [int(x) for x in file_ids.split(',')]
        env = request.env
        response = self._make_zip(zip_name, env['documents.document'].browse(ids_list))
        if token:
            response.set_cookie('fileToken', token)
        return response

    @http.route(["/document/download/all/<int:share_id>/<access_token>"], type='http', auth='public')
    def share_download_all(self, access_token=None, share_id=None):
        """
        :param share_id: id of the share, the name of the share will be the name of the zip file share.
        :param access_token: share access token
        :returns the http response for a zip file if the token and the ID are valid.
        """
        env = request.env
        try:
            share = env['documents.share'].sudo().browse(share_id)
            if share.state == 'expired':
                return request.not_found()
            if consteq(access_token, share.access_token):
                if share.action != 'upload':
                    documents = False
                    if share.type == 'domain':
                        domain = []
                        if share.domain:
                            domain = literal_eval(share.domain)
                        domain = expression.AND([domain, [['folder_id', '=', share.folder_id.id]]])
                        documents = env['documents.document'].sudo().search(domain)
                    elif share.type == 'ids':
                        documents = share.document_ids
                    return self._make_zip((share.name or 'unnamed-link') + '.zip', documents)
        except Exception:
            logger.exception("Failed to zip share link id: %s" % share_id)
        return request.not_found()

    @http.route(["/document/avatar/<int:share_id>/<access_token>"], type='http', auth='public')
    def get_avatar(self, access_token=None, share_id=None):
        """
        :param share_id: id of the share.
        :param access_token: share access token
        :returns the picture of the share author for the front-end view.
        """
        try:
            env = request.env
            share = env['documents.share'].sudo().browse(share_id)
            if consteq(access_token, share.access_token):
                return base64.b64decode(env['res.users'].sudo().browse(share.create_uid.id).image_small)
            else:
                return request.not_found()
        except Exception:
            logger.exception("Failed to download portrait id: %s" % id)
        return request.not_found()

    @http.route(["/document/thumbnail/<int:share_id>/<access_token>/<int:id>"],
                type='http', auth='public')
    def get_thumbnail(self, id=None, access_token=None, share_id=None):
        """
        :param id:  id of the document
        :param access_token: token of the share link
        :param share_id: id of the share link
        :return: the thumbnail of the document for the portal view.
        """
        try:
            env = request.env
            share = env['documents.share'].sudo().browse(share_id)
            if share.state == 'expired':
                return request.not_found()
            if consteq(share.access_token, access_token):
                return self._get_file_response(id, share_id=share.id, share_token=share.access_token, field='thumbnail')
        except Exception:
            logger.exception("Failed to download thumbnail id: %s" % id)
        return request.not_found()

    # single file download route.
    @http.route(["/document/download/<int:share_id>/<access_token>/<int:id>"],
                type='http', auth='public')
    def download_one(self, id=None, access_token=None, share_id=None, **kwargs):
        """
        used to download a single file from the portal multi-file page.

        :param id: id of the file
        :param access_token:  token of the share link
        :param share_id: id of the share link
        :return: a portal page to preview and download a single file.
        """
        env = request.env
        share = env['documents.share'].sudo().browse(share_id)
        if consteq(access_token, share.access_token):
            try:
                if share.action != 'upload' and share.state != 'expired':
                    return self._get_file_response(id, share_id=share_id, share_token=share.access_token, field='datas')
            except Exception:
                logger.exception("Failed to download document %s" % id)

        return request.not_found()

    # Upload file(s) route.
    @http.route(["/document/upload/<int:share_id>/<token>/",
                 "/document/upload/<int:share_id>/<token>/<int:document_id>"],
                type='http', auth='public', methods=['POST'], csrf=False)
    def upload_attachment(self, share_id, token, document_id=None, **kwargs):
        """
        Allows public upload if provided with the right token and share_Link.

        :param share_id: id of the share.
        :param token: share access token.
        :param document_id: id of a document request to directly upload its content
        :return if files are uploaded, recalls the share portal with the updated content.
        """
        share = http.request.env['documents.share'].sudo().browse(share_id)

        if not share.exists() or share.state != 'live' or not consteq(token, share.access_token):
            return http.request.not_found()
        documents = request.env['documents.document']
        folder = share.folder_id
        folder_id = folder.id or False
        chatter_message = '''<b>File uploaded by:</b> %s (share link)<br/>%s
                             <b>Link created by:</b> %s <br/>
                             <a href="/web#id=%s&model=documents.share&view_type=form" target="_blank">
                                <b>View the share link</b>
                             </a>''' % (
                http.request.env.user.name,
                ('<b>Link name:</b> ' + share.name + '<br/>' if share.name else ''),
                share.create_uid.name,
                share_id,
            )
        if document_id:
            document_request = http.request.env['documents.document'].sudo(share.create_uid).browse(document_id)
            if share.type == 'ids':
                documents_check = share.document_ids
            else:
                domain = expression.AND([literal_eval(share.domain or []), [('folder_id', '=', share.folder_id.id),
                                                                            ('id', '=', document_id)]])
                documents_check = http.request.env['documents.document'].sudo().search(domain)

            if not documents_check or document_request.type != 'empty':
                return http.request.not_found()
            try:
                file = request.httprequest.files.getlist('requestFile')[0]
                data = file.read()
                mimetype = self._neuter_mimetype(file.content_type, http.request.env.user)
                write_vals = {
                    'mimetype': mimetype,
                    'name': file.filename,
                    'datas_fname': file.filename,
                    'type': 'binary',
                    'datas': base64.b64encode(data),
                }
            except Exception:
                logger.exception("Failed to read uploaded file")
            else:
                document_request.with_context(binary_field_real_user=http.request.env.user).write(write_vals)
                document_request.message_post(body=chatter_message)
        elif share.action == 'downloadupload':
            try:
                for file in request.httprequest.files.getlist('files'):
                    data = file.read()
                    mimetype = self._neuter_mimetype(file.content_type, http.request.env.user)
                    document_dict = {
                        'mimetype': mimetype,
                        'name': file.filename,
                        'datas_fname': file.filename,
                        'datas': base64.b64encode(data),
                        'tag_ids': [(6, 0, share.tag_ids.ids)],
                        'partner_id': share.partner_id.id,
                        'owner_id': share.owner_id.id,
                        'folder_id': folder_id,
                    }
                    document = documents.sudo(share.create_uid).with_context(binary_field_real_user=http.request.env.user).create(document_dict)
                    document.message_post(body=chatter_message)
                    if share.activity_option:
                        document.documents_set_activity(settings_record=share)

            except Exception:
                logger.exception("Failed to upload document")

        return """<script type='text/javascript'>
                    window.open("/document/share/%s/%s", "_self");
                </script>""" % (share_id, token)

    # Frontend portals #############################################################################

    # share portals route.
    @http.route(['/document/share/<int:share_id>/<token>'], type='http', auth='public')
    def share_portal(self, share_id=None, token=None):
        """
        Leads to a public portal displaying downloadable files for anyone with the token.

        :param share_id: id of the share link
        :param token: share access token
        """
        try:
            share = http.request.env['documents.share'].sudo().search([('id', '=', share_id)])
            if share.state == 'expired':
                expired_options = {
                    'expiration_date': share.date_deadline,
                    'author': share.create_uid.name,
                }
                return request.render('documents.not_available', expired_options)
            if not consteq(token, share.access_token):
                return request.not_found()

            if share.type == 'domain':
                domain = []
                if share.domain:
                    domain = literal_eval(share.domain)
                domain += [['folder_id', '=', share.folder_id.id]]
                documents = http.request.env['documents.document'].sudo().search(domain)
            elif share.type == 'ids':
                documents = share.document_ids
            else:
                return request.not_found()

            options = {
                'base_url': http.request.env["ir.config_parameter"].sudo().get_param("web.base.url"),
                'token': str(token),
                'upload': share.action == 'downloadupload',
                'share_id': str(share.id),
                'author': share.create_uid.name,
            }
            if share.type == 'ids' and len(documents) == 1:
                options.update(document=documents[0], request_upload=True)
                return request.render('documents.share_single', options)
            else:
                options.update(all_button='binary' in [document.type for document in documents],
                               document_ids=documents,
                               request_upload=share.action == 'downloadupload' or share.type == 'ids')
                return request.render('documents.share_page', options)
        except Exception:
            logger.exception("Failed to generate the multi file share portal")
        return request.not_found()
