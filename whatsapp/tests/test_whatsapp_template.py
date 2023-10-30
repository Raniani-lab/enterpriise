# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import exceptions
from odoo.addons.whatsapp.tests.common import WhatsAppCommon
from odoo.tests import tagged, users


@tagged('wa_template')
class WhatsAppTemplate(WhatsAppCommon):

    @users('user_wa_admin')
    def test_button_validation(self):
        template = self.env['whatsapp.template'].create({
            'body': 'Hello World',
            'name': 'Test-basic',
            'status': 'approved',
            'wa_account_id': self.whatsapp_account.id,
        })

        # Test that the WhatsApp message fails validation when a phone number button with an invalid number is added.
        with self.assertRaises(exceptions.UserError):
            self._add_button_to_template(
                template, button_type="phone_number",
                call_number="91 12345 12345", name="test call fail",
            )

        # Test that the WhatsApp message fails validation when a URL button with an invalid URL is added.
        with self.assertRaises(exceptions.ValidationError):
            self._add_button_to_template(
                template, button_type='url',
                name="test url fail", website_url="odoo.com",
            )

    @users('user_wa_admin')
    def test_template_preview(self):
        """ Test preview feature from template itself """
        template = self.env['whatsapp.template'].create({
            'body': 'feel free to contact {{1}}',
            'footer_text': 'Thanks you',
            'header_text': 'Header {{1}}',
            'header_type': 'text',
            'variable_ids': [
                (5, 0, 0),
                (0, 0, {
                    'name': "{{1}}",
                    'line_type': 'body',
                    'field_type': "free_text",
                    'demo_value': "Nishant",
                }),
                (0, 0, {
                    'name': "{{1}}",
                    'line_type': 'header',
                    'field_type': "free_text",
                    'demo_value': "Jigar",
                }),
            ],
            'wa_account_id': self.whatsapp_account.id,
        })
        template_preview = self.env['whatsapp.preview'].create({
            'wa_template_id': template.id
        })
        for expected_var in ['Nishant', 'Jigar']:
            self.assertIn(expected_var, template_preview.preview_whatsapp)

    @users('user_wa_admin')
    def test_template_header_type_dynamic_text(self):
        """ Test dynamic text header """
        template = self.env['whatsapp.template'].create({
            'header_text': 'Header {{1}}',
            'header_type': 'text',
            'name': 'Header Text',
            'wa_account_id': self.whatsapp_account.id,
        })
        self.assertWATemplateVariables(
            template,
            [('{{1}}', 'header', 'free_text', {'demo_value': 'Sample Value'})]
        )

        template = self.env['whatsapp.template'].create({
            'header_text': 'Header {{1}}',
            'header_type': 'text',
            'name': 'Header Text 2',
            'variable_ids': [
                    (0, 0, {'name': '{{1}}', 'line_type': 'header', 'field_type': 'free_text', 'demo_value': 'Dynamic'}),
                ],
            'wa_account_id': self.whatsapp_account.id,
        })
        self.assertWATemplateVariables(
            template,
            [('{{1}}', 'header', 'free_text', {'demo_value': 'Dynamic'})]
        )

        for header_text in ['Hello {{1}} and {{2}}', 'hello {{2}}']:
            with self.assertRaises(exceptions.ValidationError):
                self.env['whatsapp.template'].create({
                    'header_type': 'text',
                    'header_text': header_text,
                    'name': 'Header Text 3',
                    'body': 'Body',
                    'wa_account_id': self.whatsapp_account.id,
                })

    @users('user_wa_admin')
    def test_template_header_type_location(self):
        """ Test location header type """
        template = self.env['whatsapp.template'].create({
            'header_type': 'location',
            'name': 'Header Location',
            'wa_account_id': self.whatsapp_account.id,
        })
        self.assertWATemplateVariables(
            template,
            [('name', 'location', 'free_text', {'demo_value': 'Sample Value'}),
             ('address', 'location', 'free_text', {'demo_value': 'Sample Value'}),
             ('latitude', 'location', 'free_text', {'demo_value': 'Sample Value'}),
             ('longitude', 'location', 'free_text', {'demo_value': 'Sample Value'}),
            ]
        )

        template = self.env['whatsapp.template'].create({
            'header_type': 'location',
            'name': 'Header Location 2',
            'variable_ids': [
                    (0, 0, {'name': 'name', 'line_type': 'location', 'demo_value': 'LocName'}),
                    (0, 0, {'name': 'address', 'line_type': 'location', 'demo_value': 'Gandhinagar, Gujarat'}),
                    (0, 0, {'name': 'latitude', 'line_type': 'location', 'demo_value': '23.192985'}),
                    (0, 0, {'name': 'longitude', 'line_type': 'location', 'demo_value': '72.6366633'}),
                ],
            'wa_account_id': self.whatsapp_account.id,
        })
        self.assertWATemplateVariables(
            template,
            [('name', 'location', 'free_text', {'demo_value': 'LocName'}),
             ('address', 'location', 'free_text', {'demo_value': 'Gandhinagar, Gujarat'}),
             ('latitude', 'location', 'free_text', {'demo_value': '23.192985'}),
             ('longitude', 'location', 'free_text', {'demo_value': '72.6366633'}),
            ]
        )
