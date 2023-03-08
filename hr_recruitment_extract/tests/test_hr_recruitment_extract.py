# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.hr.tests.common import TestHrCommon
from odoo.addons.iap_extract.tests.test_extract_mixin import TestExtractMixin


class TestRecruitmentExtractProcess(TestHrCommon, TestExtractMixin):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.applicant = cls.env['hr.applicant'].create({'name': 'John Doe'})
        cls.attachment = cls.env['ir.attachment'].create({
            'name': "an attachment",
            'raw': b'My attachment',
        })

    def get_result_success_response(self):
        return {
            'status': 'success',
            'results': [{
                'name': {'selected_value': {'content': 'Johnny Doe'}, 'words': []},
                'email': {'selected_value': {'content': 'john@doe.com'}, 'words': []},
                'phone': {'selected_value': {'content': '+32488888888'}, 'words': []},
                'mobile': {'selected_value': {'content': '+32499999999'}, 'words': []},
            }],
        }

    def test_auto_send_for_digitization(self):
        # test the `auto_send` mode for digitization does send the attachment upon upload
        self.env.company.recruitment_extract_show_ocr_option_selection = 'auto_send'

        with self._mock_iap_extract(self.parse_success_response()):
            self.applicant.message_post(attachment_ids=[self.attachment.id])

        self.assertEqual(self.applicant.extract_state, 'waiting_extraction')
        self.assertTrue(self.applicant.extract_state_processed)
        self.assertFalse(self.applicant.partner_name)
        self.assertFalse(self.applicant.email_from)
        self.assertFalse(self.applicant.partner_phone)
        self.assertFalse(self.applicant.partner_mobile)

        extract_response = self.get_result_success_response()
        with self._mock_iap_extract(extract_response):
            self.applicant.check_all_status()

        self.assertEqual(self.applicant.partner_name, extract_response['results'][0]['name']['selected_value']['content'])
        self.assertEqual(self.applicant.email_from, extract_response['results'][0]['email']['selected_value']['content'])
        self.assertEqual(self.applicant.partner_phone, extract_response['results'][0]['phone']['selected_value']['content'])
        self.assertEqual(self.applicant.partner_mobile, extract_response['results'][0]['mobile']['selected_value']['content'])

    def test_manual_send_for_digitization(self):
        # test the `manual_send` mode for digitization
        self.env.company.recruitment_extract_show_ocr_option_selection = 'manual_send'

        self.assertEqual(self.applicant.extract_state, 'no_extract_requested')
        self.assertFalse(self.applicant.extract_can_show_send_button)

        with self._mock_iap_extract(self.parse_success_response()):
            self.applicant.message_post(attachment_ids=[self.attachment.id])

        self.assertEqual(self.applicant.extract_state, 'no_extract_requested')
        self.assertTrue(self.applicant.extract_can_show_send_button)

        with self._mock_iap_extract(self.parse_success_response()):
            self.applicant.action_send_for_digitization()

        # upon success, no button shall be provided
        self.assertFalse(self.applicant.extract_can_show_send_button)

        extract_response = self.get_result_success_response()
        with self._mock_iap_extract(extract_response):
            self.applicant.check_all_status()

        self.assertEqual(self.applicant.partner_name, extract_response['results'][0]['name']['selected_value']['content'])
        self.assertEqual(self.applicant.email_from, extract_response['results'][0]['email']['selected_value']['content'])
        self.assertEqual(self.applicant.partner_phone, extract_response['results'][0]['phone']['selected_value']['content'])
        self.assertEqual(self.applicant.partner_mobile, extract_response['results'][0]['mobile']['selected_value']['content'])

    def test_no_send_for_digitization(self):
        # test that the `no_send` mode for digitization prevents the users from sending
        self.env.company.recruitment_extract_show_ocr_option_selection = 'no_send'

        with self._mock_iap_extract(self.parse_success_response()):
            self.applicant.message_post(attachment_ids=[self.attachment.id])

        self.assertEqual(self.applicant.extract_state, 'no_extract_requested')
        self.assertFalse(self.applicant.extract_can_show_send_button)

    def test_show_resend_button_when_not_enough_credits(self):
        # test that upon not enough credit error, the retry button is provided
        self.env.company.recruitment_extract_show_ocr_option_selection = 'auto_send'

        with self._mock_iap_extract(self.parse_credit_error_response()):
            self.applicant.message_post(attachment_ids=[self.attachment.id])

        self.assertFalse(self.applicant.extract_can_show_send_button)

    def test_status_not_ready(self):
        # test the 'processing' ocr status effects
        self.env.company.recruitment_extract_show_ocr_option_selection = 'auto_send'

        with self._mock_iap_extract(self.parse_processing_response()):
            self.applicant._check_ocr_status()

        self.assertEqual(self.applicant.extract_state, 'extract_not_ready')
        self.assertFalse(self.applicant.extract_can_show_send_button)

    def test_applicant_validation(self):
        # test that when the applicant is hired, the validation is sent to the server
        self.env.company.recruitment_extract_show_ocr_option_selection = 'auto_send'
        extract_response = self.get_result_success_response()

        with self._mock_iap_extract(extract_response):
            self.applicant._check_ocr_status()

        self.assertEqual(self.applicant.extract_state, 'waiting_validation')

        hired_stages = self.env['hr.recruitment.stage'].search([('hired_stage', '=', True)])
        with self._mock_iap_extract(self.validate_success_response()):
            self.applicant.write({'stage_id': hired_stages[0].id})

        self.assertEqual(self.applicant.extract_state, 'done')
        self.assertEqual(self.applicant.get_validation('email')['content'], self.applicant.email_from)
        self.assertEqual(self.applicant.get_validation('phone')['content'], self.applicant.partner_phone)
        self.assertEqual(self.applicant.get_validation('mobile')['content'], self.applicant.partner_mobile)
        self.assertEqual(self.applicant.get_validation('name')['content'], self.applicant.name)
