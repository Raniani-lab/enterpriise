# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _
from odoo.addons.iap.tools import iap_tools
from odoo.exceptions import UserError


CLIENT_OCR_VERSION = 100

class HrApplicant(models.Model):
    _name = 'hr.applicant'
    _inherit = ['extract.mixin', 'hr.applicant']
    # We want to see the records that are just processed by OCR at the top of the list
    _order = "extract_state_processed desc, priority desc, id desc"

    @api.depends('stage_id')
    def _compute_is_in_extractable_state(self):
        default_stage_by_job = {}
        for applicant in self:
            if not applicant.job_id:
                applicant.is_in_extractable_state = True
                continue

            if applicant.job_id.id not in default_stage_by_job:
                default_stage = self.env['hr.recruitment.stage'].search([
                    '|',
                    ('job_ids', '=', False),
                    ('job_ids', '=', applicant.job_id.id),
                    ('fold', '=', False)], order='sequence asc', limit=1)
                default_stage_by_job[applicant.job_id.id] = default_stage
            else:
                default_stage = default_stage_by_job[applicant.job_id.id]
            applicant.is_in_extractable_state = applicant.stage_id == default_stage

    def get_validation(self, field):
        text_to_send = {}
        if field == "email":
            text_to_send["content"] = self.email_from
        elif field == "phone":
            text_to_send["content"] = self.partner_phone
        elif field == "mobile":
            text_to_send["content"] = self.partner_mobile
        elif field == "name":
            text_to_send["content"] = self.name
        return text_to_send

    def write(self, vals):
        res = super().write(vals)
        if not self or 'stage_id' not in vals:
            return res
        new_stage = self[0].stage_id
        if not new_stage.hired_stage:
            return res

        self.validate_ocr()
        return res

    def _check_ocr_status(self):
        ocr_results = super()._check_ocr_status()
        if ocr_results is not None:
            name_ocr = ocr_results['name']['selected_value']['content'] if 'name' in ocr_results else ""
            email_from_ocr = ocr_results['email']['selected_value']['content'] if 'email' in ocr_results else ""
            phone_ocr = ocr_results['phone']['selected_value']['content'] if 'phone' in ocr_results else ""
            mobile_ocr = ocr_results['mobile']['selected_value']['content'] if 'mobile' in ocr_results else ""

            self.name = _("%s's Application", name_ocr)
            self.partner_name = name_ocr
            self.email_from = email_from_ocr
            self.partner_phone = phone_ocr
            self.partner_mobile = mobile_ocr
        return ocr_results

    def action_send_for_digitization(self):
        if any(not applicant.is_in_extractable_state for applicant in self):
            raise UserError(_("You cannot send a CV for an applicant who's not in first stage!"))

        self.action_manual_send_for_digitization()

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

    def _autosend_for_digitization(self):
        if self.env.company.recruitment_extract_show_ocr_option_selection == 'auto_send':
            self.filtered('extract_can_show_send_button').action_manual_send_for_digitization()

    def _contact_iap_extract(self, pathinfo, params):
        params['version'] = CLIENT_OCR_VERSION
        endpoint = self.env['ir.config_parameter'].sudo().get_param('hr_recruitment_extract_endpoint', 'https://iap-extract.odoo.com')
        return iap_tools.iap_jsonrpc(endpoint + '/api/extract/applicant/1/' + pathinfo, params=params)

    def _get_iap_bus_notification_content(self):
        return _("CV is being Digitized")

    def _get_ocr_module_name(self):
        return 'hr_recruitment_extract'

    def _get_ocr_option_can_extract(self):
        ocr_option = self.env.company.recruitment_extract_show_ocr_option_selection
        return ocr_option and ocr_option != 'no_send'

    def _get_validation_fields(self):
        return ['email', 'mobile', 'name', 'phone']

    def _message_set_main_attachment_id(self, attachment_ids):
        res = super()._message_set_main_attachment_id(attachment_ids)
        self._autosend_for_digitization()
        return res
