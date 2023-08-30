# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
import string

from odoo import api, models, _
from odoo.addons.iap.tools import iap_tools
from odoo.exceptions import UserError


OCR_VERSION = 102

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

    def _fill_document_with_results(self, ocr_results, force_write=False):
        if ocr_results is not None:
            name_ocr = self.get_ocr_selected_value(ocr_results, 'name', "")
            email_from_ocr = self.get_ocr_selected_value(ocr_results, 'email', "")
            phone_ocr = self.get_ocr_selected_value(ocr_results, 'phone', "")
            mobile_ocr = self.get_ocr_selected_value(ocr_results, 'mobile', "")

            self.name = _("%s's Application", name_ocr)
            self.partner_name = name_ocr
            self.email_from = email_from_ocr
            self.partner_phone = phone_ocr
            self.partner_mobile = mobile_ocr

            # If the 'hr_recruitment_skills' module is installed, extract skills from OCR results
            if self.env['ir.module.module']._get('hr_recruitment_skills').state == 'installed':
                ocr_text_lower = ocr_results['full_text_annotation'].lower()
                splitting_characters = string.punctuation.replace('-', '') + ' ' + '\n'
                ocr_tokens = re.split('|'.join(re.escape(char) for char in splitting_characters), ocr_text_lower)
                target_search_set = set(filter(lambda token: len(token) >= 3, ocr_tokens))
                skills = self.env['hr.skill'].search([]).filtered(
                    lambda skill: skill.name.lower() in target_search_set and len(skill.name) >= 3)

                applicant_skills = self.env['hr.applicant.skill']
                for skill in skills:
                    existing_applicant_skill = self.env['hr.applicant.skill'].search([
                        ('applicant_id', '=', self.id),
                        ('skill_id', '=', skill.id),
                    ])

                    if not existing_applicant_skill:
                        applicant_skill = self.env['hr.applicant.skill'].create({
                            'applicant_id': self.id,
                            'skill_id': skill.id,
                            'skill_type_id': skill.skill_type_id.id,
                            'skill_level_id': skill.skill_type_id.skill_level_ids.filtered('default_level').id,
                        })
                        applicant_skills += applicant_skill

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
        params['version'] = OCR_VERSION
        endpoint = self.env['ir.config_parameter'].sudo().get_param('iap_extract_endpoint', 'https://extract.api.odoo.com')
        return iap_tools.iap_jsonrpc(endpoint + '/api/extract/applicant/1/' + pathinfo, params=params)

    def _get_iap_bus_notification_content(self):
        return _("Resume is being Digitized")

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
