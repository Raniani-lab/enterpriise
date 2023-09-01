# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import requests
import threading
import json

from odoo import _
from odoo.exceptions import RedirectWarning
from odoo.addons.whatsapp.tools.whatsapp_exception import WhatsAppError

_logger = logging.getLogger(__name__)

DEFAULT_ENDPOINT = "https://graph.facebook.com/v17.0"

class WhatsAppApi:
    def __init__(self, wa_account_id):
        wa_account_id.ensure_one()
        self.wa_account_id = wa_account_id
        self.phone_uid = wa_account_id.phone_uid
        self.token = wa_account_id.sudo().token
        self.is_shared_account = False

    def __api_requests(self, request_type, url, auth_type="", params=False, headers=None, data=False, files=False, endpoint_include=False):
        if getattr(threading.current_thread(), 'testing', False):
            raise WhatsAppError("API requests disabled in testing.")

        headers = headers or {}
        params = params or {}
        if not all([self.token, self.phone_uid]):
            action = self.wa_account_id.env.ref('whatsapp.whatsapp_account_action')
            raise RedirectWarning(_("To use WhatsApp Configure it first"), action=action.id, button_text=_("Configure Whatsapp Business Account"))
        if auth_type == 'oauth':
            headers.update({'Authorization': f'OAuth {self.token}'})
        if auth_type == 'bearer':
            headers.update({'Authorization': f'Bearer {self.token}'})
        call_url = (DEFAULT_ENDPOINT + url) if not endpoint_include else url

        try:
            res = requests.request(request_type, call_url, params=params, headers=headers, data=data, files=files, timeout=10)
        except requests.exceptions.RequestException:
            raise WhatsAppError(failure_type='network')

        # raise if json-parseable and 'error' in json
        try:
            if 'error' in res.json():
                raise WhatsAppError(*self._prepare_error_response(res.json()))
        except ValueError:
            if not res.ok:
                raise WhatsAppError(failure_type='network')

        return res

    def _prepare_error_response(self, response):
        """
            This method is used to prepare error response
            :return tuple[str, int]: (error_message, whatsapp_error_code | -1)
        """
        if response.get('error'):
            error = response['error']
            desc = error.get('message')
            code = error.get('code', 'odoo')
            return (desc if desc else _("{error_code} - Non-descript Error", code), code)
        return (_("Something went wrong when contacting WhatsApp, please try again later. If this happens frequently, contact support."), -1)

    def _get_all_template(self):
        """
            This method is used to get all the template from the WhatsApp Business Account

            API Documentation: https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates
        """
        if self.is_shared_account:
            raise WhatsAppError(failure_type='account')

        response = self.__api_requests("GET", f"/{self.wa_account_id.account_uid}/message_templates",
                                       auth_type="bearer")
        return response.json()

    def _get_template_data(self, wa_template_uid):
        """
            This method is used to get one template details using template uid from the WhatsApp Business Account

            API Documentation: https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates
        """
        if self.is_shared_account:
            raise WhatsAppError(failure_type='account')

        response = self.__api_requests("GET", f"/{wa_template_uid}", auth_type="bearer")
        return response.json()

    def _upload_demo_document(self, attachment):
        """
            This method is used to get a handle to later upload a demo document.
            Only use for template registration.

            API documentation https://developers.facebook.com/docs/graph-api/guides/upload
        """
        if self.is_shared_account:
            raise WhatsAppError(failure_type='account')

        # Open session
        app_uid = self.wa_account_id.app_uid
        params = {
            'file_length': attachment.file_size,
            'file_type': attachment.mimetype,
            'access_token': self.token,
        }
        uploads_session_response = self.__api_requests("POST", f"/{app_uid}/uploads", params=params)
        uploads_session_response_json = uploads_session_response.json()
        upload_session_id = uploads_session_response_json.get('id')
        if not upload_session_id:
            raise WhatsAppError(_("Document upload session open failed, please retry after sometime."))
        # Upload file
        upload_file_response = self.__api_requests("POST", f"/{upload_session_id}", params=params, auth_type="oauth", headers={'file_offset': '0'}, data=attachment.datas)
        upload_file_response_json = upload_file_response.json()
        file_handle = upload_file_response_json.get('h')
        if not file_handle:
            raise WhatsAppError(_("Document upload failed, please retry after sometime."))
        return file_handle

    def _submit_template_new(self, json_data):
        """
            This method is used to submit template for approval
            If template was submitted before, we have wa_template_uid and we call template update URL

            API Documentation: https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates#Creating
        """
        if self.is_shared_account:
            raise WhatsAppError(failure_type='account')
        response = self.__api_requests("POST", f"/{self.wa_account_id.account_uid}/message_templates",
                                       auth_type="bearer", headers={'Content-Type': 'application/json'}, data=json_data)
        response_json = response.json()
        if response_json.get('id'):
            return {'id': response_json['id'], 'status': response_json['status']}
        raise WhatsAppError(*self._prepare_error_response(response_json))


    def _submit_template_update(self, json_data, wa_template_uid):
        if self.is_shared_account:
            raise WhatsAppError(failure_type='account')
        response = self.__api_requests("POST", f"/{wa_template_uid}",
                                       auth_type="bearer", headers={'Content-Type': 'application/json'}, data=json_data)
        response_json = response.json()
        if response_json.get('success'):
            return True
        raise WhatsAppError(*self._prepare_error_response(response_json))

    def _send_whatsapp(self, number, message_type, send_vals, parent_message_id=False):
        """ Send WA messages for all message type using WhatsApp Business Account

        API Documentation:
            Normal        - https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
            Template send - https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
        """
        data = {
            'messaging_product': 'whatsapp',
            'recipient_type': 'individual',
            'to': number
        }
        # if there is parent_message_id then we send message as reply
        if parent_message_id:
            data.update({
                'context': {
                    'message_id': parent_message_id
                },
            })
        if message_type in ('template', 'text', 'document', 'image', 'audio', 'video'):
            data.update({
                'type': message_type,
                message_type: send_vals
            })
        json_data = json.dumps(data)
        response = self.__api_requests(
            "POST",
            f"/{self.phone_uid}/messages",
            auth_type="bearer",
            headers={'Content-Type': 'application/json'},
            data=json_data
        )
        response_json = response.json()
        if response_json.get('messages'):
            msg_uid = response_json['messages'][0]['id']
            return msg_uid
        raise WhatsAppError(*self._prepare_error_response(response_json))

    def _get_whatsapp_document(self, document_id):
        """
            This method is used to get document from WhatsApp sent by user

            API Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
        """
        response = self.__api_requests("GET", f"/{document_id}", auth_type="bearer")
        response_json = response.json()
        file_url = response_json.get('url')
        file_response = self.__api_requests("GET", file_url, auth_type="bearer", endpoint_include=True)
        return file_response.content

    def _upload_whatsapp_document(self, attachment):
        """
            This method is used to upload document for sending via WhatsApp

            API Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
        """
        payload = {'messaging_product': 'whatsapp'}
        files = [('file', (attachment.name, attachment.raw, attachment.mimetype))]
        response = self.__api_requests("POST", f"/{self.phone_uid}/media", auth_type='bearer', data=payload, files=files)
        response_json = response.json()
        if response_json.get('id'):
            return response_json['id']
        raise WhatsAppError(*self._prepare_error_response(response_json))

    def _test_connection(self):
        """ This method is used to test connection of WhatsApp Business Account"""
        response = self.__api_requests("GET", f"/{self.wa_account_id.account_uid}/phone_numbers", auth_type='bearer')
        data = response.json().get('data', [])
        phone_values = [phone['id'] for phone in data if 'id' in phone]
        if self.wa_account_id.phone_uid not in phone_values:
            raise WhatsAppError(_("Phone number Id is wrong."), 'account')
        uploads_session_response = self.__api_requests("POST", f"/{self.wa_account_id.app_uid}/uploads", params={'access_token': self.token})
        upload_session_id = uploads_session_response.json().get('id')
        if not upload_session_id:
            raise WhatsAppError(*self._prepare_error_response(uploads_session_response.json()))
        return