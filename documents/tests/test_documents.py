# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase
import base64

GIF = b"R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs="
TEXT = base64.b64encode(bytes("TEST", 'utf-8'))
DATA = "data:application/zip;base64,R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs="
file_a = {'name': 'doc.zip', 'data': 'data:application/zip;base64,R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs='}
file_b = {'name': 'icon.zip', 'data': 'data:application/zip;base64,R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs='}


class TestCaseDocuments(TransactionCase):
    """ """
    def setUp(self):
        super(TestCaseDocuments, self).setUp()
        self.folder_a = self.env['documents.folder'].create({
            'name': 'folder A',
        })
        self.folder_a_a = self.env['documents.folder'].create({
            'name': 'folder A - A',
            'parent_folder_id': self.folder_a.id,
        })
        self.folder_b = self.env['documents.folder'].create({
            'name': 'folder B',
        })
        self.tag_category_b = self.env['documents.facet'].create({
            'folder_id': self.folder_b.id,
            'name': "categ_b",
        })
        self.tag_b = self.env['documents.tag'].create({
            'facet_id': self.tag_category_b.id,
            'name': "tag_b",
        })
        self.tag_category_a = self.env['documents.facet'].create({
            'folder_id': self.folder_a.id,
            'name': "categ_a",
        })
        self.tag_category_a_a = self.env['documents.facet'].create({
            'folder_id': self.folder_a_a.id,
            'name': "categ_a_a",
        })
        self.tag_a_a = self.env['documents.tag'].create({
            'facet_id': self.tag_category_a_a.id,
            'name': "tag_a_a",
        })
        self.tag_a = self.env['documents.tag'].create({
            'facet_id': self.tag_category_a.id,
            'name': "tag_a",
        })
        self.document_gif = self.env['documents.document'].create({
            'datas': GIF,
            'name': 'Test mimetype gif',
            'datas_fname': 'file.gif',
            'mimetype': 'image/gif',
            'folder_id': self.folder_b.id,
        })
        self.document_txt = self.env['documents.document'].create({
            'datas': TEXT,
            'name': 'Test mimetype txt',
            'datas_fname': 'file.txt',
            'mimetype': 'text/plain',
            'folder_id': self.folder_b.id,
        })
        self.share_link_ids = self.env['documents.share'].create({
            'document_ids': [(4, self.document_txt.id, 0)],
            'type': 'ids',
            'name': 'share_link_ids',
            'folder_id': self.folder_a_a.id,
        })
        self.share_link_folder = self.env['documents.share'].create({
            'folder_id': self.folder_a_a.id,
            'name': "share_link_folder",
        })
        self.tag_action_a = self.env['documents.workflow.action'].create({
            'action': 'add',
            'facet_id': self.tag_category_b.id,
            'tag_id': self.tag_b.id,
        })
        self.worflow_rule = self.env['documents.workflow.rule'].create({
            'domain_folder_id': self.folder_a_a.id,
            'name': 'workflow rule on f_a_a',
            'folder_id': self.folder_b.id,
            'tag_action_ids': [(4, self.tag_action_a.id, 0)],
            'remove_activities': True,
            'activity_option': True,
            'activity_type_id': self.env.ref('documents.mail_documents_activity_data_Inbox').id,
            'activity_summary': 'test workflow rule activity summary',
            'activity_date_deadline_range': 7,
            'activity_date_deadline_range_type': 'days',
            'activity_note': 'activity test note',
        })

    def test_documents_create_from_attachment(self):
        """
        Tests a documents.document create method when created from an already existing ir.attachment.
        """
        attachment = self.env['ir.attachment'].create({
            'name': 'attachment name',
            'datas': GIF,
            'datas_fname': 'attachmentGif.gif',
            'res_model': 'documents.document',
            'res_id': 0,
        })
        document_a = self.env['documents.document'].create({
            'folder_id': self.folder_b.id,
            'name': 'new name',
            'attachment_id': attachment.id,
        })
        self.assertEqual(document_a.attachment_id.id, attachment.id,
                         'the attachment should be the attachment given in the create values')
        self.assertEqual(document_a.name, 'new name',
                         'the name should be taken from the ir attachment')
        self.assertEqual(document_a.res_model, 'documents.document',
                         'the res_model should be set as document by default')
        self.assertEqual(document_a.res_id, document_a.id,
                         'the res_id should be set as its own id by default to allow access right inheritance')

    def test_documents_create_write(self):
        """
        Tests a documents.document create and write method,
        documents should automatically create a new ir.attachments in relevant cases.
        """
        document_a = self.env['documents.document'].create({
            'name': 'Test mimetype gif',
            'datas': GIF,
            'folder_id': self.folder_b.id,
        })
        self.assertEqual(document_a.res_model, 'documents.document',
                         'the res_model should be set as document by default')
        self.assertEqual(document_a.res_id, document_a.id,
                         'the res_id should be set as its own id by default to allow access right inheritance')
        self.assertEqual(document_a.attachment_id.datas, GIF, 'the document should have a GIF data')
        document_no_attachment = self.env['documents.document'].create({
            'name': 'Test mimetype gif',
            'folder_id': self.folder_b.id,
        })
        self.assertFalse(document_no_attachment.attachment_id, 'the new document shouldnt have any attachment_id')
        document_no_attachment.write({'datas': TEXT})
        self.assertEqual(document_no_attachment.attachment_id.datas, TEXT, 'the document should have an attachment')

    def test_documents_rules(self):
        """
        Tests a documents.workflow.rule
        """
        self.worflow_rule.apply_actions([self.document_gif.id, self.document_txt.id])
        self.assertTrue(self.tag_b.id in self.document_gif.tag_ids.ids, "failed at workflow rule add tag id")
        self.assertTrue(self.tag_b.id in self.document_txt.tag_ids.ids, "failed at workflow rule add tag id txt")
        self.assertEqual(len(self.document_gif.tag_ids.ids), 1, "failed at workflow rule add tag len")

        activity_gif = self.env['mail.activity'].search(['&',
                                                         ('res_id', '=', self.document_gif.id),
                                                         ('res_model', '=', 'documents.document')])

        self.assertEqual(len(activity_gif), 1, "failed at workflow rule activity len")
        self.assertTrue(activity_gif.exists(), "failed at workflow rule activity exists")
        self.assertEqual(activity_gif.summary, 'test workflow rule activity summary',
                         "failed at activity data summary from workflow create activity")
        self.assertEqual(activity_gif.note, '<p>activity test note</p>',
                         "failed at activity data note from workflow create activity")
        self.assertEqual(activity_gif.activity_type_id.id,
                         self.env.ref('documents.mail_documents_activity_data_Inbox').id,
                         "failed at activity data note from workflow create activity")

        self.assertEqual(self.document_gif.folder_id.id, self.folder_b.id, "failed at workflow rule set folder gif")
        self.assertEqual(self.document_txt.folder_id.id, self.folder_b.id, "failed at workflow rule set folder txt")

    def test_documents_rule_display(self):
        """
        tests criteria of rules
        """
        self.tag_criteria_b = self.env['documents.workflow.tag.criteria'].create({
            'operator': 'contains',
            'facet_id': self.tag_category_b.id,
            'tag_id': self.tag_b.id,
        })

        self.tag_criteria_not_a_a = self.env['documents.workflow.tag.criteria'].create({
            'operator': 'notcontains',
            'facet_id': self.tag_category_a_a.id,
            'tag_id': self.tag_a_a.id,
        })

        self.workflow_rule_criteria = self.env['documents.workflow.rule'].create({
            'domain_folder_id': self.folder_a.id,
            'name': 'workflow rule on f_a & criteria',
            'condition_type': 'criteria',
            'criteria_tag_ids': [(6, 0, [self.tag_criteria_b.id, self.tag_criteria_not_a_a.id])]
        })
        self.document_txt_criteria_a = self.env['documents.document'].create({
            'name': 'Test criteria a',
            'mimetype': 'text/plain',
            'folder_id': self.folder_a.id,
            'tag_ids': [(6, 0, [self.tag_a_a.id, self.tag_b.id])]
        })

        self.assertTrue(self.workflow_rule_criteria.id not in self.document_txt_criteria_a.available_rule_ids.ids,
                        "failed at documents_workflow_rule unavailable rule")

        self.document_txt_criteria_b = self.env['documents.document'].create({
            'name': 'Test criteria b',
            'mimetype': 'text/plain',
            'folder_id': self.folder_a.id,
            'tag_ids': [(6, 0, [self.tag_a.id])]
        })

        self.assertTrue(self.workflow_rule_criteria.id not in self.document_txt_criteria_b.available_rule_ids.ids,
                        "failed at documents_workflow_rule unavailable rule")
        self.document_txt_criteria_c = self.env['documents.document'].create({
            'datas': TEXT,
            'name': 'Test criteria c',
            'datas_fname': 'file.txt',
            'mimetype': 'text/plain',
            'folder_id': self.folder_a.id,
            'tag_ids': [(6, 0, [self.tag_b.id])]
        })

        self.assertTrue(self.workflow_rule_criteria.id in self.document_txt_criteria_c.available_rule_ids.ids,
                        "failed at documents_workflow_rule available rule")

        self.document_txt_criteria_d = self.env['documents.document'].create({
            'name': 'Test criteria d',
            'mimetype': 'text/plain',
            'folder_id': self.folder_b.id,
            'tag_ids': [(6, 0, [self.tag_b.id])]
        })

        self.assertTrue(self.workflow_rule_criteria.id not in self.document_txt_criteria_d.available_rule_ids.ids,
                        "failed at documents_workflow_rule unavailable rule")

    def test_documents_share_links(self):
        """
        Tests document share links
        """

        # by Folder
        vals = {
            'folder_id': self.folder_b.id,
            'domain': [],
            'tag_ids': [(6, 0, [])],
            'type': 'domain',
        }
        action_folder = self.env['documents.share'].create_share(vals)
        result_share_folder = self.env['documents.share'].search([('folder_id', '=', self.folder_b.id)])
        result_share_folder_act = self.env['documents.share'].browse(action_folder['res_id'])
        self.assertEqual(result_share_folder.id, result_share_folder_act.id, "failed at share link by folder")
        self.assertEqual(result_share_folder_act.type, 'domain', "failed at share link type domain")

        # by Folder with upload and activites
        vals = {
            'folder_id': self.folder_b.id,
            'domain': [],
            'tag_ids': [(6, 0, [])],
            'type': 'domain',
            'date_deadline': '3052-01-01',
            'action': 'downloadupload',
            'activity_option': True,
            'activity_type_id': self.ref('documents.mail_documents_activity_data_tv'),
            'activity_summary': 'test by Folder with upload and activites',
            'activity_date_deadline_range': 4,
            'activity_date_deadline_range_type': 'days',
            'activity_user_id': self.env.user.id,
        }
        action_folder_with_upload = self.env['documents.share'].create_share(vals)
        share_folder_with_upload = self.env['documents.share'].browse(action_folder_with_upload['res_id'])
        self.assertTrue(share_folder_with_upload.exists(), 'failed at upload folder creation')
        self.assertEqual(share_folder_with_upload.activity_type_id.name, 'To validate',
                         'failed at activity type for upload documents')
        self.assertEqual(share_folder_with_upload.state, 'live', "failed at share_link live")

        # by documents
        vals = {
            'document_ids': [(6, 0, [self.document_gif.id, self.document_txt.id])],
            'folder_id': self.folder_b.id,
            'date_deadline': '2001-11-05',
            'type': 'ids',
        }
        action_documents = self.env['documents.share'].create_share(vals)
        result_share_documents_act = self.env['documents.share'].browse(action_documents['res_id'])

        # Expiration date
        self.assertEqual(result_share_documents_act.state, 'expired', "failed at share_link expired")
