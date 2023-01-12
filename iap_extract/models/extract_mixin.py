# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from psycopg2 import IntegrityError, OperationalError

from odoo import api, fields, models, _lt
from odoo.exceptions import AccessError, UserError


_logger = logging.getLogger(__name__)

# list of result id that can be sent by iap-extract
SUCCESS = 0
NOT_READY = 1
ERROR_INTERNAL = 2
ERROR_NOT_ENOUGH_CREDIT = 3
ERROR_DOCUMENT_NOT_FOUND = 4
ERROR_NO_DOCUMENT_NAME = 5
ERROR_UNSUPPORTED_IMAGE_FORMAT = 6
ERROR_FILE_NAMES_NOT_MATCHING = 7
ERROR_NO_CONNECTION = 8
ERROR_SERVER_IN_MAINTENANCE = 9
ERROR_PASSWORD_PROTECTED = 10
ERROR_TOO_MANY_PAGES = 11
ERROR_INVALID_ACCOUNT_TOKEN = 12
ERROR_UNSUPPORTED_IMAGE_SIZE = 14
ERROR_NO_PAGE_COUNT = 15
ERROR_CONVERSION_PDF2IMAGE = 16

ERROR_MESSAGES = {
    ERROR_INTERNAL: _lt("An error occurred"),
    ERROR_DOCUMENT_NOT_FOUND: _lt("The document could not be found"),
    ERROR_NO_DOCUMENT_NAME: _lt("No document name provided"),
    ERROR_UNSUPPORTED_IMAGE_FORMAT: _lt("Unsupported image format"),
    ERROR_FILE_NAMES_NOT_MATCHING: _lt("You must send the same quantity of documents and file names"),
    ERROR_NO_CONNECTION: _lt("Server not available. Please retry later"),
    ERROR_SERVER_IN_MAINTENANCE: _lt("Server is currently under maintenance. Please retry later"),
    ERROR_PASSWORD_PROTECTED: _lt("Your PDF file is protected by a password. The OCR can't extract data from it"),
    ERROR_TOO_MANY_PAGES: _lt("Your invoice is too heavy to be processed by the OCR. "
                              "Try to reduce the number of pages and avoid pages with too many text"),
    ERROR_INVALID_ACCOUNT_TOKEN: _lt("The 'invoice_ocr' IAP account token is invalid. "
                                     "Please delete it to let Odoo generate a new one or fill it with a valid token."),
    ERROR_UNSUPPORTED_IMAGE_SIZE: _lt("The document has been rejected because it is too small"),
    ERROR_NO_PAGE_COUNT: _lt("Invalid PDF (Unable to get page count)"),
    ERROR_CONVERSION_PDF2IMAGE: _lt("Invalid PDF (Conversion error)"),
}


class ExtractMixin(models.AbstractModel):
    """ Base model to inherit from to add extract functionality to a model. """
    _name = 'extract.mixin'
    _inherit = 'mail.thread'
    _description = 'Base class to extract data from documents'

    extract_state = fields.Selection([
            ('no_extract_requested', 'No extract requested'),
            ('not_enough_credit', 'Not enough credit'),
            ('error_status', 'An error occurred'),
            ('waiting_upload', 'Waiting upload'),
            ('waiting_extraction', 'Waiting extraction'),
            ('extract_not_ready', 'waiting extraction, but it is not ready'),
            ('waiting_validation', 'Waiting validation'),
            ('to_validate', 'To validate'),
            ('done', 'Completed flow'),
        ],
        'Extract state', default='no_extract_requested', required=True, copy=False)
    extract_status_code = fields.Integer('Status code', copy=False)
    extract_error_message = fields.Text('Error message', compute='_compute_error_message')
    extract_remote_id = fields.Integer('Id of the request to IAP-OCR', default='-1', copy=False, readonly=True)
    extract_can_show_send_button = fields.Boolean('Can show the ocr send button', compute='_compute_show_send_button')
    is_in_extractable_state = fields.Boolean(compute='_compute_is_in_extractable_state', store=True)
    extract_state_processed = fields.Boolean(compute='_compute_extract_state_processed', store=True)

    @api.depends('extract_status_code')
    def _compute_error_message(self):
        for record in self:
            if record.extract_status_code in (SUCCESS, NOT_READY):
                record.extract_error_message = ''
            else:
                record.extract_error_message = ERROR_MESSAGES.get(
                    record.extract_status_code, ERROR_MESSAGES[ERROR_INTERNAL]
                )

    @api.depends('extract_state')
    def _compute_extract_state_processed(self):
        for record in self:
            record.extract_state_processed = record.extract_state in ['waiting_extraction', 'waiting_upload']

    @api.depends('is_in_extractable_state', 'extract_state', 'message_main_attachment_id')
    def _compute_show_send_button(self):
        for record in self:
            record.extract_can_show_send_button = (
                record._get_ocr_option_can_extract()
                and record.message_main_attachment_id
                and record.extract_state == 'no_extract_requested'
                and record.is_in_extractable_state
            )

    @api.depends()
    def _compute_is_in_extractable_state(self):
        """ Compute the is_in_extractable_state field. This method is meant to be overridden """
        return None

    @api.model
    def check_all_status(self):
        for record in self.search(self._get_to_check_domain()):
            record._try_to_check_ocr_status()

    @api.model
    def _contact_iap_extract(self, pathinfo, params):
        """ Contact the IAP extract service and return the response. This method is meant to be overridden """
        return {}

    @api.model
    def _cron_parse(self):
        for rec in self.search([('extract_state', '=', 'waiting_upload')]):
            try:
                with self.env.cr.savepoint():
                    rec.retry_ocr()
                self.env.cr.commit()
            except (IntegrityError, OperationalError) as e:
                _logger.error("Couldn't upload %s with id %d: %s", rec._name, rec.id, str(e))

    @api.model
    def _cron_validate(self):
        records_to_validate = self.search(self._get_validation_domain())
        documents = {
            record.extract_remote_id: {
                field: record.get_validation(field),
            } for record in records_to_validate for field in self._get_validation_fields()
        }

        if documents:
            try:
                self._contact_iap_extract('validate_batch', params={'documents': documents})
            except AccessError:
                pass

        records_to_validate.extract_state = 'done'
        return records_to_validate

    def action_manual_send_for_digitization(self):
        """ Manually trigger the ocr flow for the records.
        This function is meant to be overridden, and called with a title.
        """
        for rec in self:
            rec.env['iap.account']._send_iap_bus_notification(
                service_name='invoice_ocr',
                title=self._get_iap_bus_notification_content())
        self.extract_state = 'waiting_upload'
        self._get_cron_ocr('parse')._trigger()

    def buy_credits(self):
        url = self.env['iap.account'].get_credits_url(base_url='', service_name='invoice_ocr')
        return {
            'type': 'ir.actions.act_url',
            'url': url,
        }

    def check_ocr_status(self):
        """ Actively check the status of the extraction on the concerned records. """
        if any(rec.extract_state == 'waiting_upload' for rec in self):
            _logger.info('Manual trigger of the parse cron')
            try:
                cron_ocr_parse = self._get_cron_ocr('parse')
                cron_ocr_parse._try_lock()
                cron_ocr_parse.sudo().method_direct_trigger()
            except UserError:
                _logger.warning('Lock acquiring failed, cron is already running')
                return

        records_to_check = self.filtered(lambda a: a.extract_state in ['waiting_extraction', 'extract_not_ready'])

        for record in records_to_check:
            record._check_ocr_status()

        limit = max(0, 20 - len(records_to_check))
        if limit > 0:
            records_to_preupdate = self.search([
                ('extract_state', 'in', ['waiting_extraction', 'extract_not_ready']),
                ('id', 'not in', records_to_check.ids),
                ('is_in_extractable_state', '=', True)], limit=limit)
            for record in records_to_preupdate:
                record._try_to_check_ocr_status()

    def get_validation(self):
        """ Return the validation of the record. This method is meant to be overridden """
        return None

    def retry_ocr(self):
        """ Retry to contact iap to submit the first attachment in the chatter. """
        self.ensure_one()
        if not self._get_ocr_option_can_extract():
            return False
        attachments = self.message_main_attachment_id
        if (
                attachments.exists() and
                self.extract_state in ['no_extract_requested', 'waiting_upload', 'not_enough_credit', 'error_status']
        ):
            account_token = self.env['iap.account'].get('invoice_ocr')
            # This line contact iap to create account if this is the first request.
            # It allow iap to give free credits if the database is elligible
            self.env['iap.account'].get_credits('invoice_ocr')
            if not account_token.account_token:
                self.extract_state = 'error_status'
                self.extract_status_code = ERROR_INVALID_ACCOUNT_TOKEN
                return

            user_infos = {
                'user_lang': self.env.user.lang,
                'user_email': self.env.user.email,
            }
            params = {
                'account_token': account_token.account_token,
                'dbuuid': self.env['ir.config_parameter'].sudo().get_param('database.uuid'),
                'documents': [x.datas.decode('utf-8') for x in attachments],
                'user_infos': user_infos,
                'webhook_url': self._get_webhook_url(),
            }
            try:
                result = self._contact_iap_extract('parse', params=params)
                self.extract_status_code = result['status_code']
                if result['status_code'] == SUCCESS:
                    self.extract_state = 'waiting_extraction'
                    self.extract_remote_id = result['document_id']
                    if self.env['ir.config_parameter'].sudo().get_param("iap_extract.already_notified", True):
                        self.env['ir.config_parameter'].sudo().set_param("iap_extract.already_notified", False)
                    self._retry_ocr_success_callback()
                elif result['status_code'] == ERROR_NOT_ENOUGH_CREDIT:
                    self.send_no_credit_notification()
                    self.extract_state = 'not_enough_credit'
                else:
                    self.extract_state = 'error_status'
                    _logger.warning('There was an issue while doing the OCR operation on this file. Error: -1')

            except AccessError:
                self.extract_state = 'error_status'
                self.extract_status_code = ERROR_NO_CONNECTION

    def send_no_credit_notification(self):
        """
        Notify about the number of credit.
        In order to avoid to spam people each hour, an ir.config_parameter is set
        """
        #If we don't find the config parameter, we consider it True, because we don't want to notify if no credits has been bought earlier.
        already_notified = self.env['ir.config_parameter'].sudo().get_param("iap_extract.already_notified", True)
        if already_notified:
            return
        try:
            mail_template = self.env.ref('iap_extract.iap_extract_no_credit')
        except ValueError:
            #if the mail template has not been created by an upgrade of the module
            return
        iap_account = self.env['iap.account'].search([('service_name', '=', "invoice_ocr")], limit=1)
        if iap_account:
            # Get the email address of the creators of the records
            res = self.env['res.users'].search_read([('id', '=', 2)], ['email'])
            if res:
                email_values = {
                    'email_to': res[0]['email']
                }
                mail_template.send_mail(iap_account.id, force_send=True, email_values=email_values)
                self.env['ir.config_parameter'].sudo().set_param("iap_extract.already_notified", True)

    def validate_ocr(self):
        self.extract_state = 'to_validate'
        self._get_cron_ocr('validate')._trigger()

    def _check_ocr_status(self):
        """ Contact iap to get the actual status of the ocr request. This function returns the OCR results if any. """
        self.ensure_one()
        result = self._contact_iap_extract('get_result', params={'document_id': self.extract_remote_id})
        self.extract_status_code = result['status_code']
        ocr_results = None
        if result['status_code'] == SUCCESS:
            self.extract_state = 'waiting_validation'
            ocr_results = result['results'][0]
        elif result['status_code'] == NOT_READY:
            self.extract_state = 'extract_not_ready'
        else:
            self.extract_state = 'error_status'
        return ocr_results

    def _get_cron_ocr(self, ocr_action):
        """ Return the cron used to parse the documents, based on the module name.
        ocr_action can be 'parse' or 'validate'.
        """
        module_name = self._get_ocr_module_name()
        return self.env.ref(f'{module_name}.ir_cron_ocr_{ocr_action}')

    def _get_iap_bus_notification_content(self):
        """ Return the content that needs to be passed as bus notification. This method is meant to be overridden """
        return ''

    def _get_ocr_module_name(self):
        """ Returns the name of the module. This method is meant to be overridden """
        return 'iap_extract'

    def _get_ocr_option_can_extract(self):
        """ Returns if we can use the extract capabilities of the module. This method is meant to be overridden """
        return False

    def _get_to_check_domain(self):
        return [('is_in_extractable_state', '=', True),
                ('extract_state', 'in', ['waiting_extraction', 'extract_not_ready'])]

    def _get_validation_domain(self):
        return [('extract_state', '=', 'to_validate')]

    def _get_validation_fields(self):
        """ Returns the fields that should be checked to validate the record. This method is meant to be overridden """
        return []

    def _get_webhook_url(self):
        """ Return the webhook url based on the module name. """
        baseurl = self.get_base_url()
        module_name = self._get_ocr_module_name()
        return f'{baseurl}/{module_name}/request_done'

    def _retry_ocr_success_callback(self):
        """ This method is called when the OCR flow is successful. This method is meant to be overridden """
        return None

    def _try_to_check_ocr_status(self):
        self.ensure_one()
        try:
            self._check_ocr_status()
        except Exception:
            pass
