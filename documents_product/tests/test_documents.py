# -*- coding: utf-8 -*-

import base64
from odoo.tests.common import HttpCase, tagged, SavepointCase, TransactionCase, post_install

GIF = b"R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs="
TEXT = base64.b64encode(bytes("workflow bridge product", 'utf-8'))


@tagged('post_install', '-at_install')
class TestCaseDocumentsBridgeProduct(TransactionCase):
    
    def setUp(self):
        super(TestCaseDocumentsBridgeProduct, self).setUp()
        self.folder_test = self.env['documents.folder'].create({'name': 'folder_test'})
        self.company_test = self.env['res.company'].create({
            'name': 'test bridge products',
            'product_folder': self.folder_test.id,
            'documents_product_settings': False
        })
        self.template_test = self.env['product.template'].create({
            'name': 'template_test',
            'company_id': self.company_test.id
        })
        self.product_test = self.env['product.product'].create({
            'name': 'product_test',
            'product_tmpl_id': self.template_test.id
        })
        self.attachment_txt_two = self.env['ir.attachment'].create({
            'datas': TEXT,
            'name': 'Test two txt',
            'datas_fname': 'fileTextTwo.txt',
            'mimetype': 'text/plain',
        })
        self.attachment_gif_two = self.env['ir.attachment'].create({
            'datas': GIF,
            'name': 'Test gif two',
            'datas_fname': 'fileTwoGif.gif',
            'mimetype': 'image/gif',
        })

    def test_bridge_folder_product_settings_on_write(self):
        """
        Makes sure the settings apply their values when an document is assigned a res_model, res_id
        """
        self.company_test.write({'documents_product_settings': True})
        
        self.attachment_gif_two.write({
            'res_model': 'product.product',
            'res_id': self.product_test.id
        })
        self.attachment_txt_two.write({
            'res_model': 'product.template',
            'res_id': self.template_test.id
        })

        txt_doc = self.env['documents.document'].search([('attachment_id', '=', self.attachment_txt_two.id)])
        gif_doc = self.env['documents.document'].search([('attachment_id', '=', self.attachment_gif_two.id)])

        self.assertEqual(txt_doc.folder_id, self.folder_test, 'the text two document have a folder')
        self.assertEqual(gif_doc.folder_id, self.folder_test, 'the gif two document have a folder')
