from odoo.addons.hr_expense.tests.common import TestExpenseCommon
from odoo.addons.iap_extract.tests.test_extract_mixin import TestExtractMixin
from odoo.tests import tagged
from odoo.tools import float_compare


@tagged('post_install', '-at_install')
class TestExpenseExtractProcess(TestExpenseCommon, TestExtractMixin):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Set the standard price to 0 to take the price from extract
        cls.product_a.write({'standard_price': 0})
        cls.expense = cls.env['hr.expense'].create({
            'employee_id': cls.expense_employee.id,
            'name': cls.product_a.display_name,
            'product_id': cls.product_a.id,
            'unit_amount': 0,
        })
        cls.attachment = cls.env['ir.attachment'].create({
            'name': "product_a.jpg",
            'raw': b'My expense',
        })

    def get_result_success_response(self):
        return {
            'status': 'success',
            'results': [{
                'description': {'selected_value': {'content': 'food', 'candidates': []}},
                'total': {'selected_value': {'content': 99.99, 'candidates': []}},
                'date': {'selected_value': {'content': '2022-02-22', 'candidates': []}},
                'currency': {'selected_value': {'content': 'euro', 'candidates': []}},
                'bill_reference': {'selected_value': {'content': 'bill-ref007', 'candidates': []}},
            }],
        }

    def test_auto_send_for_digitization(self):
        # test that the uploaded attachment is sent to the extract server when `auto_send` is set
        self.env.company.expense_extract_show_ocr_option_selection = 'auto_send'

        usd_currency = self.env.ref('base.USD')
        eur_currency = self.env.ref('base.EUR')
        eur_currency.active = True

        with self._mock_iap_extract(self.parse_success_response()):
            self.expense.message_post(attachment_ids=[self.attachment.id])

        self.assertEqual(self.expense.extract_state, 'waiting_extraction')
        self.assertTrue(self.expense.extract_state_processed)
        self.assertEqual(self.expense.predicted_category, 'miscellaneous')
        self.assertFalse(self.expense.total_amount)
        self.assertFalse(self.expense.reference)
        self.assertEqual(self.expense.currency_id, usd_currency)

        extract_response = self.get_result_success_response()
        with self._mock_iap_extract(extract_response):
            self.expense.check_all_status()

        ext_result = extract_response['results'][0]
        self.assertEqual(self.expense.extract_state, 'waiting_validation')
        self.assertEqual(float_compare(self.expense.total_amount, ext_result['total']['selected_value']['content'], 2), 0)
        self.assertEqual(self.expense.currency_id, eur_currency)
        self.assertEqual(str(self.expense.date), ext_result['date']['selected_value']['content'])
        self.assertEqual(self.expense.name, self.expense.predicted_category, ext_result['description']['selected_value']['content'])
        self.assertEqual(self.expense.product_id, self.product_a)
        self.assertEqual(self.expense.reference, ext_result['bill_reference']['selected_value']['content'])

    def test_manual_send_for_digitization(self):
        # test the `manual_send` mode for digitization.
        self.env.company.expense_extract_show_ocr_option_selection = 'manual_send'
        extract_response = self.get_result_success_response()

        eur_currency = self.env.ref('base.EUR')
        eur_currency.active = True

        self.assertEqual(self.expense.extract_state, 'no_extract_requested')
        self.assertFalse(self.expense.extract_can_show_send_button)

        with self._mock_iap_extract(self.parse_success_response()):
            self.expense.message_post(attachment_ids=[self.attachment.id])

        self.assertEqual(self.expense.extract_state, 'no_extract_requested')
        self.assertTrue(self.expense.extract_can_show_send_button)

        with self._mock_iap_extract(self.parse_success_response()):
            self.expense.action_send_for_digitization()

        # upon success, no button shall be provided
        self.assertFalse(self.expense.extract_can_show_send_button)

        with self._mock_iap_extract(extract_response):
            self.expense.check_all_status()

        ext_result = extract_response['results'][0]
        self.assertEqual(self.expense.extract_state, 'waiting_validation')
        self.assertEqual(float_compare(self.expense.total_amount, ext_result['total']['selected_value']['content'], 2), 0)
        self.assertEqual(self.expense.currency_id, eur_currency)
        self.assertEqual(str(self.expense.date), ext_result['date']['selected_value']['content'])
        self.assertEqual(self.expense.name, self.expense.predicted_category, ext_result['description']['selected_value']['content'])
        self.assertEqual(self.expense.product_id, self.product_a)
        self.assertEqual(self.expense.reference, ext_result['bill_reference']['selected_value']['content'])

    def test_no_send_for_digitization(self):
        # test that the `no_send` mode for digitization prevents the users from sending
        self.env.company.expense_extract_show_ocr_option_selection = 'no_send'

        with self._mock_iap_extract(self.parse_success_response()):
            self.expense.message_post(attachment_ids=[self.attachment.id])

        self.assertEqual(self.expense.extract_state, 'no_extract_requested')
        self.assertFalse(self.expense.extract_can_show_send_button)

    def test_show_resend_button_when_not_enough_credits(self):
        # test that upon not enough credit error, the retry button is provided
        self.env.company.expense_extract_show_ocr_option_selection = 'auto_send'

        with self._mock_iap_extract(self.parse_credit_error_response()):
            self.expense.message_post(attachment_ids=[self.attachment.id])

        self.assertFalse(self.expense.extract_can_show_send_button)

    def test_status_not_ready(self):
        # test the 'processing' ocr status effects
        self.env.company.expense_extract_show_ocr_option_selection = 'auto_send'

        with self._mock_iap_extract(self.parse_processing_response()):
            self.expense._check_ocr_status()

        self.assertEqual(self.expense.extract_state, 'extract_not_ready')
        self.assertFalse(self.expense.extract_can_show_send_button)

    def test_expense_validation(self):
        # test that when the expense is hired, the validation is sent to the server
        self.env.company.expense_extract_show_ocr_option_selection = 'auto_send'

        with self._mock_iap_extract(self.parse_success_response()):
            self.expense.message_post(attachment_ids=[self.attachment.id])

        with self._mock_iap_extract(self.get_result_success_response()):
            self.expense._check_ocr_status()

        self.assertEqual(self.expense.extract_state, 'waiting_validation')

        with self._mock_iap_extract(self.validate_success_response()):
            self.expense.action_submit_expenses()

        self.assertEqual(self.expense.extract_state, 'done')
        self.assertEqual(self.expense.get_validation('total')['content'], self.expense.unit_amount)
        self.assertEqual(self.expense.get_validation('date')['content'], str(self.expense.date))
        self.assertEqual(self.expense.get_validation('description')['content'], self.expense.name)
        self.assertEqual(self.expense.get_validation('currency')['content'], self.expense.currency_id.name)
        self.assertEqual(self.expense.get_validation('bill_reference')['content'], self.expense.reference)
