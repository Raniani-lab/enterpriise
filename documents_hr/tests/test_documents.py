# -*- coding: utf-8 -*-

import base64
from odoo.tests.common import HttpCase, tagged, SavepointCase, TransactionCase, post_install

TEXT = base64.b64encode(bytes("documents_hr", 'utf-8'))


@tagged('post_install', '-at_install', 'test_document_bridge')
class TestCaseDocumentsBridgeHR(TransactionCase):

    def test_bridge_hr_settings_on_write(self):
        """
        Makes sure the settings apply their values when an ir_attachment is set as message_main_attachment_id
        on invoices.
        """
        documents_user = self.env['res.users'].create({
            'name': "documents test basic user",
            'login': "dtbu",
            'email': "dtbu@yourcompany.com",
            'groups_id': [(6, 0, [self.ref('documents.group_documents_user')])]
        })

        folder_test = self.env['documents.folder'].create({'name': 'folder_test'})
        company = self.env.user.company_id
        company.documents_hr_settings = True
        company.documents_hr_folder = folder_test.id
        employee = self.env['hr.employee'].create({
            'name': 'User Empl Employee',
            'user_id': documents_user.id,
        })
        attachment_txt_test = self.env['ir.attachment'].create({
            'datas': TEXT,
            'name': 'fileText_test.txt',
            'mimetype': 'text/plain',
            'res_model': 'hr.employee',
            'res_id': employee.id,
        })

        document = self.env['documents.document'].search([('attachment_id', '=', attachment_txt_test.id)])
        self.assertTrue(document.exists(), "There should be a new document created from the attachment")
        self.assertEqual(document.owner_id, documents_user, "The owner_id should be the document user")
