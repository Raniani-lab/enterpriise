# -*- coding: utf-8 -*-

import base64
from odoo.tests.common import HttpCase, tagged, SavepointCase, TransactionCase, post_install

GIF = b"R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs="
TEXT = base64.b64encode(bytes("workflow bridge account", 'utf-8'))


@tagged('post_install', '-at_install', 'test_document_bridge')
class TestCaseDocumentsBridgeAccount(TransactionCase):

    def setUp(self):
        super(TestCaseDocumentsBridgeAccount, self).setUp()
        self.folder_a = self.env['documents.folder'].create({
            'name': 'folder A',
        })
        self.folder_a_a = self.env['documents.folder'].create({
            'name': 'folder A - A',
            'parent_folder_id': self.folder_a.id,
        })
        self.document_txt = self.env['documents.document'].create({
            'datas': TEXT,
            'name': 'Test mimetype txt',
            'datas_fname': 'file.txt',
            'mimetype': 'text/plain',
            'folder_id': self.folder_a_a.id,
        })
        self.document_gif = self.env['documents.document'].create({
            'datas': GIF,
            'name': 'Test mimetype gif',
            'datas_fname': 'file.gif',
            'mimetype': 'image/gif',
            'folder_id': self.folder_a.id,
        })

        self.workflow_rule_vendor_bill = self.env['documents.workflow.rule'].create({
            'domain_folder_id': self.folder_a.id,
            'name': 'workflow rule create vendor bill on f_a',
            'create_model': 'account.invoice.in_invoice',
        })

    def test_bridge_folder_workflow(self):
        """
        tests the create new business model (vendor bill & credit note).

        """
        self.assertEqual(self.document_txt.res_model, 'documents.document', "failed at default res model")
        multi_return = self.workflow_rule_vendor_bill.apply_actions([self.document_txt.id, self.document_gif.id])
        self.assertEqual(multi_return.get('type'), 'ir.actions.act_window',
                         'failed at invoice workflow return value type')
        self.assertEqual(multi_return.get('res_model'), 'account.invoice',
                         'failed at invoice workflow return value res model')
        self.assertEqual(multi_return.get('view_type'), 'list',
                         'failed at invoice workflow return value view type')

        self.assertEqual(self.document_txt.res_model, 'account.invoice', "failed at workflow_bridge_dms_account"
                                                                           " new res_model")
        vendor_bill_txt = self.env['account.invoice'].search([('id', '=', self.document_txt.res_id)])
        self.assertTrue(vendor_bill_txt.exists(), 'failed at workflow_bridge_dms_account vendor_bill')
        self.assertEqual(self.document_txt.res_id, vendor_bill_txt.id, "failed at workflow_bridge_dms_account res_id")
        self.assertEqual(vendor_bill_txt.type, 'in_invoice', "failed at workflow_bridge_dms_account vendor_bill type")
        vendor_bill_gif = self.env['account.invoice'].search([('id', '=', self.document_gif.res_id)])
        self.assertEqual(self.document_gif.res_id, vendor_bill_gif.id, "failed at workflow_bridge_dms_account res_id")

        single_return = self.workflow_rule_vendor_bill.apply_actions([self.document_txt.id])
        self.assertEqual(single_return.get('view_type'), 'form',
                         'failed at invoice workflow return value view type for single file')
        self.assertEqual(single_return.get('res_model'), 'account.invoice',
                         'failed at invoice res_model action from workflow create model')
        invoice = self.env[single_return['res_model']].browse(single_return.get('res_id'))
        attachments = self.env['ir.attachment'].search([('res_model', '=', 'account.invoice'), ('res_id', '=', invoice.id)])
        self.assertEqual(len(attachments), 1, 'there should only be one ir attachment matching')

    def test_bridge_account_account_settings_on_write(self):
        """
        Makes sure the settings apply their values when an document is assigned a res_model, res_id
        """
        folder_test = self.env['documents.folder'].create({'name': 'folder_test'})
        
        company_test = self.env['res.company'].create({
            'name': 'test bridge accounts',
            'account_folder': folder_test.id,
            'documents_account_settings': False
        })
        invoice_test = self.env['account.invoice'].create({
            'name': 'invoice_test',
            'company_id': company_test.id
        })
        document_txt_test = self.env['ir.attachment'].create({
            'datas': TEXT,
            'name': 'Test test txt',
            'datas_fname': 'fileText_test.txt',
            'mimetype': 'text/plain',
        })
        
        company_test.write({'documents_account_settings': True})

        document_txt_test.write({
            'res_model': 'account.invoice',
            'res_id': invoice_test.id
        })

        txt_doc = self.env['documents.document'].search([('attachment_id', '=', document_txt_test.id)])

        self.assertEqual(txt_doc.folder_id, folder_test, 'the text test document have a folder')

    def test_reconciliation_request(self):
        account_type_test = self.env['account.account.type'].create({'name': 'account type test', 'type': 'other'})
        account_test = self.env['account.account'].create(
            {'name': 'Receivable', 'code': '0000222', 'user_type_id': account_type_test.id, 'reconcile': True})
        journal_test = self.env['account.journal'].create({'name': 'journal test', 'type': 'bank', 'code': 'BNK67'})
        account_move_test = self.env['account.move'].create(
            {'name': 'account move test', 'state': 'posted', 'journal_id': journal_test.id})
        account_move_line_test = self.env['account.move.line'].create({
            'name': 'account move line test',
            'move_id': account_move_test.id,
            'account_id': account_test.id,
        })

        document_test = self.env['documents.document'].create({
            'name': 'test reconciliation workflow',
            'folder_id': self.folder_a.id,
            'res_model': 'account.move.line',
            'res_id': account_move_line_test.id,
            'datas': TEXT,
        })

        action = self.workflow_rule_vendor_bill.apply_actions([document_test.id])
        self.assertEqual(action['res_model'], 'account.invoice', 'a new invoice should be generated')
        invoice = self.env['account.invoice'].browse(action['res_id'])
        self.assertEqual(invoice.reconciliation_move_line_id.id, account_move_line_test.id,
                         'the new invoice should store the ID of the move line on which its document was attached')
