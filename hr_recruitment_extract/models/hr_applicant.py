# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.iap.tools import iap_tools
from odoo import api, fields, models, _lt, _
from odoo.exceptions import AccessError, UserError

import logging


_logger = logging.getLogger(__name__)

CLIENT_OCR_VERSION = 100

# list of result id that can be sent by iap-extract
SUCCESS = 0
NOT_READY = 1
ERROR_INTERNAL = 2
ERROR_NOT_ENOUGH_CREDIT = 3
ERROR_DOCUMENT_NOT_FOUND = 4
ERROR_UNSUPPORTED_IMAGE_FORMAT = 6
ERROR_NO_CONNECTION = 8
ERROR_SERVER_IN_MAINTENANCE = 9

ERROR_MESSAGES = {
    ERROR_INTERNAL: _lt("An error occurred"),
    ERROR_DOCUMENT_NOT_FOUND: _lt("The document could not be found"),
    ERROR_UNSUPPORTED_IMAGE_FORMAT: _lt("Unsupported image format"),
    ERROR_NO_CONNECTION: _lt("Server not available. Please retry later"),
    ERROR_SERVER_IN_MAINTENANCE: _lt("Server is currently under maintenance. Please retry later"),
}


class HrApplicant(models.Model):
    _inherit = 'hr.applicant'
    _order = "state_processed desc, priority desc, id desc"

    extract_state = fields.Selection(
        selection=[
            ('no_extract_requested', 'No extract requested'),
            ('not_enough_credit', 'Not enough credit'),
            ('error_status', 'An error occurred'),
            ('waiting_extraction', 'Waiting extraction'),
            ('extract_not_ready', 'Waiting extraction, but not ready'),
            ('waiting_validation', 'Waiting validation'),
            ('done', 'Completed flow')],
        string='Extract State',
        default='no_extract_requested',
        required=True,
        copy=False)
    extract_status_code = fields.Integer("Status code", copy=False)
    extract_error_message = fields.Text("Error message", compute='_compute_error_message')
    extract_remote_id = fields.Integer("Request ID to IAP-OCR", default="-1", copy=False, readonly=True)
    extract_can_show_resend_button = fields.Boolean(compute='_compute_show_resend_button')
    extract_can_show_send_button = fields.Boolean(compute='_compute_show_send_button')
    # We want to see the records that are just processed by OCR at the top of the list
    state_processed = fields.Boolean(compute='_compute_state_processed', store=True)

    is_first_stage = fields.Boolean(compute='_compute_is_first_stage', store=True)

    @api.depends('stage_id')
    def _compute_is_first_stage(self):
        default_stage_by_job = {}
        for applicant in self:
            if applicant.job_id.id not in default_stage_by_job:
                default_stage = self.env['hr.recruitment.stage'].search([
                    '|',
                    ('job_ids', '=', False),
                    ('job_ids', '=', applicant.job_id.id),
                    ('fold', '=', False)], order='sequence asc', limit=1)
                default_stage_by_job[applicant.job_id.id] = default_stage
            else:
                default_stage = default_stage_by_job[applicant.job_id.id]
            applicant.is_first_stage = applicant.stage_id == default_stage

    @api.depends('extract_status_code')
    def _compute_error_message(self):
        for applicant in self:
            if applicant.extract_status_code not in [SUCCESS, NOT_READY]:
                applicant.extract_error_message = ERROR_MESSAGES.get(applicant.extract_status_code, ERROR_MESSAGES[ERROR_INTERNAL])
            else:
                applicant.extract_error_message = False

    def _can_show_send_button(self, resend=False):
        self.ensure_one()
        if (not self.env.company.recruitment_extract_show_ocr_option_selection or self.env.company.recruitment_extract_show_ocr_option_selection == 'no_send') \
                or not self.message_main_attachment_id \
                or (resend and self.extract_state not in ['error_status', 'not_enough_credit', 'module_not_up_to_date']) \
                or (not resend and self.extract_state not in ['no_extract_requested']) \
                or not self.is_first_stage:
            return False
        return True

    @api.depends('stage_id', 'extract_state', 'message_main_attachment_id')
    def _compute_show_send_button(self):
        for applicant in self:
            applicant.extract_can_show_send_button = applicant._can_show_send_button()

    @api.depends('stage_id', 'extract_state', 'message_main_attachment_id')
    def _compute_show_resend_button(self):
        for applicant in self:
            applicant.extract_can_show_resend_button = applicant._can_show_send_button(resend=True)

    @api.depends('extract_state')
    def _compute_state_processed(self):
        for applicant in self:
            applicant.state_processed = applicant.extract_state == 'waiting_extraction'

    def get_validation(self, field):
        text_to_send = {}
        if field == "email":
            text_to_send["content"] = self.email_from
        elif field == "phone":
            text_to_send["content"] = self.partner_phone
        elif field == "description":
            text_to_send["content"] = self.name
        return text_to_send

    def write(self, vals):
        """Send user corrected values to the ocr"""
        res = super().write(vals)
        if not self or 'stage_id' not in vals:
            return res
        new_stage = self[0].stage_id
        if not new_stage.hired_stage:
            return res

        endpoint = self.env['ir.config_parameter'].sudo().get_param(
            'hr_recruitment_extract_endpoint', 'https://iap-extract.odoo.com') + '/api/recruitment_extract/1/validate'
        for applicant in self:
            if applicant.extract_state != 'waiting_validation':
                continue
            values = {
                'email': applicant.get_validation('email'),
                'phone': applicant.get_validation('phone'),
                'description': applicant.get_validation('description'),
            }
            params = {
                'document_id': applicant.extract_remote_id,
                'version': CLIENT_OCR_VERSION,
                'values': values
            }
            try:
                iap_tools.iap_jsonrpc(endpoint, params=params)
                applicant.extract_state = 'done'
            except AccessError:
                pass
        return res

    @api.model
    def check_all_status(self):
        applicants_to_check = self.search([
            ('is_first_stage', '=', True),
            ('extract_state', 'in', ['waiting_extraction', 'extract_not_ready'])])
        for applicant in applicants_to_check:
            try:
                applicant._check_ocr_status()
            except Exception:
                pass

    def check_ocr_status(self):
        """contact iap to get the actual status of the ocr requests"""
        applicants_to_check = self.filtered(lambda a: a.extract_state in ['waiting_extraction', 'extract_not_ready'])

        for applicant in applicants_to_check:
            applicant._check_ocr_status()

        limit = max(0, 20 - len(applicants_to_check))
        if limit > 0:
            applicants_to_preupdate = self.search([
                ('extract_state', 'in', ['waiting_extraction', 'extract_not_ready']),
                ('id', 'not in', applicants_to_check.ids),
                ('is_first_stage', '=', True)], limit=limit)
            for applicant in applicants_to_preupdate:
                try:
                    applicant._check_ocr_status()
                except Exception:
                    pass

    def _check_ocr_status(self):
        self.ensure_one()
        endpoint = self.env['ir.config_parameter'].sudo().get_param(
            'hr_recruitment_extract_endpoint', 'https://iap-extract.odoo.com') + '/api/recruitment_extract/1/get_result'
        params = {
            'version': CLIENT_OCR_VERSION,
            'document_id': self.extract_remote_id
        }
        result = iap_tools.iap_jsonrpc(endpoint, params=params)
        self.extract_status_code = result['status_code']
        if result['status_code'] == SUCCESS:
            self.extract_state = "waiting_validation"
            ocr_results = result['results'][0]

            description_ocr = ocr_results['description']['selected_value']['content'] if 'description' in ocr_results else ""
            email_from_ocr = ocr_results['email']['selected_value']['content'] if 'email' in ocr_results else ""
            phone_ocr = ocr_results['phone']['selected_value']['content'] if 'phone' in ocr_results else ""

            self.name = description_ocr
            self.email_from = email_from_ocr
            self.partner_mobile = phone_ocr
            self.partner_phone = phone_ocr

        elif result['status_code'] == NOT_READY:
            self.extract_state = 'extract_not_ready'
        else:
            self.extract_state = 'error_status'

    def action_send_for_digitalization(self):
        if any(not applicant.is_first_stage for applicant in self):
            raise UserError(_("You cannot send a CV for an applicant who's not in first stage!"))

        for applicant in self:
            applicant.retry_ocr()

        if len(self) == 1:
            return {
                'name': _('Generated Applicant'),
                'type': 'ir.actions.act_window',
                'res_model': 'hr.applicant',
                'view_mode': 'form',
                'views': [[False, 'form']],
                'res_id': self[0].id,
            }
        return {
            'name': _('Generated Applicants'),
            'type': 'ir.actions.act_window',
            'res_model': 'hr.applicant',
            'view_mode': 'tree,form',
            'target': 'current',
            'domain': [('id', 'in', self.ids)],
        }

    def retry_ocr(self):
        """Retry to contact iap to submit the first attachment in the chatter"""
        if not self.env.company.recruitment_extract_show_ocr_option_selection or self.env.company.recruitment_extract_show_ocr_option_selection == 'no_send':
            return False
        attachments = self.message_main_attachment_id
        if attachments and attachments.exists() and self.extract_state in ['no_extract_requested', 'not_enough_credit', 'error_status', 'module_not_up_to_date']:
            account_token = self.env['iap.account'].get('invoice_ocr')
            endpoint = self.env['ir.config_parameter'].sudo().get_param(
                    'hr_recruitment_extract_endpoint', 'https://iap-extract.odoo.com') + '/api/recruitment_extract/1/parse'

            #this line contact iap to create account if this is the first request. This allow iap to give free credits if the database is elligible
            self.env['iap.account'].get_credits('invoice_ocr')

            user_infos = {
                'user_lang': self.env.user.lang,
                'user_email': self.env.user.email,
            }
            baseurl = self.get_base_url()
            webhook_url = f"{baseurl}/hr_recruitment_extract/request_done"
            params = {
                'account_token': account_token.account_token,
                'version': CLIENT_OCR_VERSION,
                'dbuuid': self.env['ir.config_parameter'].sudo().get_param('database.uuid'),
                'documents': [x.datas.decode('utf-8') for x in attachments],
                'file_names': [x.name for x in attachments],
                'user_infos': user_infos,
                'webhook_url': webhook_url,
            }
            try:
                result = iap_tools.iap_jsonrpc(endpoint, params=params)
                self.extract_status_code = result['status_code']
                if result['status_code'] == SUCCESS:
                    self.extract_state = 'waiting_extraction'
                    self.extract_remote_id = result['document_id']
                    self.env['iap.account']._send_iap_bus_notification(
                        service_name='invoice_ocr',
                        title=_("CV is being Digitized"))
                elif result['status_code'] == ERROR_NOT_ENOUGH_CREDIT:
                    self.extract_state = 'not_enough_credit'
                    self.env['iap.account']._send_iap_bus_notification(
                        service_name='invoice_ocr',
                        title=_("Not enough credits for CV Digitalization"),
                        error_type='credit')
                else:
                    self.extract_state = 'error_status'
                    _logger.warning('There was an issue while doing the OCR operation on this file. Error: -1')

            except AccessError:
                self.extract_state = 'error_status'
                self.extract_status_code = ERROR_NO_CONNECTION

    def buy_credits(self):
        url = self.env['iap.account'].get_credits_url(base_url='', service_name='invoice_ocr')
        return {
            'type': 'ir.actions.act_url',
            'url': url,
        }

    def _message_set_main_attachment_id(self, attachment_ids):
        res = super()._message_set_main_attachment_id(attachment_ids)
        for applicant in self:
            if applicant._needs_auto_extract() and applicant.message_main_attachment_id:
                applicant.retry_ocr()
        return res

    def _needs_auto_extract(self):
        """ Returns `True` if the document should be automatically sent to the extraction server"""
        return self.extract_state == "no_extract_requested"
