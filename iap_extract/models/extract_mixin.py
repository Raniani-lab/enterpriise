# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from dateutil.relativedelta import relativedelta
from psycopg2 import IntegrityError, OperationalError

from odoo import api, fields, models, _lt
from odoo.exceptions import AccessError, UserError


_logger = logging.getLogger(__name__)

ERROR_MESSAGES = {
    'error_internal': _lt("An error occurred"),
    'error_document_not_found': _lt("The document could not be found"),
    'error_unsupported_format': _lt("Unsupported image format"),
    'error_no_connection': _lt("Server not available. Please retry later"),
    'error_maintenance': _lt("Server is currently under maintenance. Please retry later"),
    'error_password_protected': _lt("Your PDF file is protected by a password. The OCR can't extract data from it"),
    'error_too_many_pages': _lt(
        "Your invoice is too heavy to be processed by the OCR. "
        "Try to reduce the number of pages and avoid pages with too many text"),
    'error_invalid_account_token': _lt(
        "The 'invoice_ocr' IAP account token is invalid. "
        "Please delete it to let Odoo generate a new one or fill it with a valid token."),
    'error_unsupported_size': _lt("The document has been rejected because it is too small"),
    'error_no_page_count': _lt("Invalid PDF (Unable to get page count)"),
    'error_pdf_conversion_to_images': _lt("Invalid PDF (Conversion error)"),
}


class ExtractMixin(models.AbstractModel):
    """ Base model to inherit from to add extract functionality to a model. """
    _name = 'extract.mixin'
    _inherit = 'mail.thread.main.attachment'
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
    extract_status = fields.Char('Extract status', copy=False)
    extract_error_message = fields.Text('Error message', compute='_compute_error_message')
    extract_document_uuid = fields.Char('ID of the request to IAP-OCR', copy=False, readonly=True)
    extract_can_show_send_button = fields.Boolean('Can show the ocr send button', compute='_compute_show_send_button')
    is_in_extractable_state = fields.Boolean(compute='_compute_is_in_extractable_state', store=True)
    extract_state_processed = fields.Boolean(compute='_compute_extract_state_processed', store=True)

    @api.depends('extract_status')
    def _compute_error_message(self):
        for record in self:
            if record.extract_status in ('success', 'processing'):
                record.extract_error_message = ''
            else:
                record.extract_error_message = ERROR_MESSAGES.get(
                    record.extract_status, ERROR_MESSAGES['error_internal']
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
                with self.env.cr.savepoint(flush=False):
                    rec.with_company(rec.company_id).upload_to_extract()
                    # We handle the flush manually so that if an error occurs, e.g. a concurrent update error,
                    # the savepoint will be rollbacked when exiting the context manager
                    self.env.cr.flush()
                self.env.cr.commit()
            except (IntegrityError, OperationalError) as e:
                _logger.error("Couldn't upload %s with id %d: %s", rec._name, rec.id, str(e))

    @api.model
    def _cron_validate(self):
        records_to_validate = self.search(self._get_validation_domain())
        documents = {
            record.extract_document_uuid: {
                field: record.get_validation(field) for field in self._get_validation_fields()
            } for record in records_to_validate
        }

        if documents:
            try:
                self._contact_iap_extract('validate_batch', params={'documents': documents})
            except AccessError:
                pass

        records_to_validate.extract_state = 'done'
        return records_to_validate

    @staticmethod
    def get_ocr_selected_value(ocr_results, feature, default=None):
        return ocr_results.get(feature, {}).get('selected_value', {}).get('content', default)

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

    def get_user_infos(self):
        user_infos = {
            'user_lang': self.env.user.lang,
            'user_email': self.env.user.email,
        }
        return user_infos

    def get_validation(self):
        """ Return the validation of the record. This method is meant to be overridden """
        return None

    def upload_to_extract(self):
        """ Contacts IAP extract to parse the first attachment in the chatter."""
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
            # It allows iap to give free credits if the database is eligible
            self.env['iap.account'].get_credits('invoice_ocr')
            if not account_token.account_token:
                self.extract_state = 'error_status'
                self.extract_status = 'error_invalid_account_token'
                return

            user_infos = self.get_user_infos()
            params = {
                'account_token': account_token.account_token,
                'dbuuid': self.env['ir.config_parameter'].sudo().get_param('database.uuid'),
                'documents': [x.datas.decode('utf-8') for x in attachments],
                'user_infos': user_infos,
                'webhook_url': self._get_webhook_url(),
            }
            try:
                result = self._contact_iap_extract('parse', params=params)
                self.extract_status = result['status']
                if result['status'] == 'success':
                    self.extract_state = 'waiting_extraction'
                    self.extract_document_uuid = result['document_uuid']
                    if self.env['ir.config_parameter'].sudo().get_param("iap_extract.already_notified", True):
                        self.env['ir.config_parameter'].sudo().set_param("iap_extract.already_notified", False)
                    self._upload_to_extract_success_callback()
                elif result['status'] == 'error_no_credit':
                    self.send_no_credit_notification()
                    self.extract_state = 'not_enough_credit'
                else:
                    self.extract_state = 'error_status'
                    _logger.warning('There was an issue while doing the OCR operation on this file. Error: -1')

            except AccessError:
                self.extract_state = 'error_status'
                self.extract_status = 'error_no_connection'

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
        documents_to_validate = self.filtered(lambda doc: doc.extract_state == 'waiting_validation')
        documents_to_validate.extract_state = 'to_validate'

        if documents_to_validate:
            ocr_trigger_datetime = fields.Datetime.now() + relativedelta(minutes=self.env.context.get('ocr_trigger_delta', 0))
            self._get_cron_ocr('validate')._trigger(at=ocr_trigger_datetime)

    def _check_ocr_status(self, force_write=False):
        """ Contact iap to get the actual status of the ocr request. """
        self.ensure_one()
        result = self._contact_iap_extract('get_result', params={'document_uuid': self.extract_document_uuid})
        self.extract_status = result['status']
        if result['status'] == 'success':
            self.extract_state = 'waiting_validation'
            # Set OdooBot as the author of the tracking message
            self._track_set_author(self.env.ref('base.partner_root'))
            self._fill_document_with_results(result['results'][0], force_write=force_write)

        elif result['status'] == 'processing':
            self.extract_state = 'extract_not_ready'
        else:
            self.extract_state = 'error_status'

    def _fill_document_with_results(self, ocr_results, force_write=False):
        """ Fill the document with the results of the OCR. This method is meant to be overridden """
        raise NotImplementedError()

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

    def _upload_to_extract_success_callback(self):
        """ This method is called when the OCR flow is successful. This method is meant to be overridden """
        return None

    def _try_to_check_ocr_status(self):
        self.ensure_one()
        try:
            self._check_ocr_status()
        except Exception:
            pass
