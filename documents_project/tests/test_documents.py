# -*- coding: utf-8 -*-

import base64
from datetime import date, timedelta

from odoo import Command

from odoo.addons.project.tests.test_project_base import TestProjectCommon

GIF = b"R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs="
TEXT = base64.b64encode(bytes("workflow bridge project", 'utf-8'))


class TestCaseDocumentsBridgeProject(TestProjectCommon):

    def setUp(self):
        super(TestCaseDocumentsBridgeProject, self).setUp()
        self.folder_a = self.env['documents.folder'].create({
            'name': 'folder A',
        })
        self.folder_a_a = self.env['documents.folder'].create({
            'name': 'folder A - A',
            'parent_folder_id': self.folder_a.id,
        })
        self.attachment_txt = self.env['documents.document'].create({
            'datas': TEXT,
            'name': 'file.txt',
            'mimetype': 'text/plain',
            'folder_id': self.folder_a_a.id,
        })
        self.workflow_rule_task = self.env['documents.workflow.rule'].create({
            'domain_folder_id': self.folder_a.id,
            'name': 'workflow rule create task on f_a',
            'create_model': 'project.task',
        })

    def test_bridge_folder_workflow(self):
        """
        tests the create new business model (project).

        """
        self.assertEqual(self.attachment_txt.res_model, 'documents.document', "failed at default res model")
        self.workflow_rule_task.apply_actions([self.attachment_txt.id])

        self.assertEqual(self.attachment_txt.res_model, 'project.task', "failed at workflow_bridge_documents_project"
                                                                        " new res_model")
        task = self.env['project.task'].search([('id', '=', self.attachment_txt.res_id)])
        self.assertTrue(task.exists(), 'failed at workflow_bridge_documents_project task')
        self.assertEqual(self.attachment_txt.res_id, task.id, "failed at workflow_bridge_documents_project res_id")

    def test_bridge_project_settings(self):
        """
        Tests that the documents feature is automatically enabled on new and existing projects when globally enabled
        """
        self.assertFalse(self.env.company.project_use_documents, "The documents feature should be disabled by default.")
        self.assertFalse(self.project_pigs.documents_folder_id or self.project_goats.documents_folder_id, "The projects should have no workspace while the feature has never been enabled.")

        self.env['res.config.settings'].create({'project_use_documents': True}).execute()

        self.assertTrue(self.env.company.project_use_documents, "The documents feature should be enabled.")
        self.assertTrue(self.project_pigs.use_documents and self.project_goats.use_documents, "The document feature should be automatically enabled on existing projects.")
        self.assertTrue(self.project_pigs.documents_folder_id and self.project_goats.documents_folder_id, "A workspace should be automatically created for the projects.")
        self.assertEqual(self.project_pigs.name, self.project_pigs.documents_folder_id.name, "The created workspace should have the same name as the project.")
        self.assertEqual(self.project_pigs.company_id, self.project_pigs.documents_folder_id.company_id, "The created workspace should have the same company as the project.")

    def test_bridge_parent_folder(self):
        """
        Tests the "Parent Workspace" setting
        """
        parent_folder = self.env['documents.folder'].create({
            'name': 'Parent Folder',
        })
        self.env['res.config.settings'].create({
            'project_documents_parent_folder': parent_folder.id,
            'project_use_documents': True,
        }).execute()
        self.assertEqual(self.project_pigs.documents_folder_id.parent_folder_id, parent_folder, "The workspace of the project should be a child of the workspace set as parent workspace in the settings.")

    def test_bridge_template_folder(self):
        """
        Tests the "Template Workspace" setting
        """
        template_folder = self.env['documents.folder'].create({
            'name': 'Template',
            'description': 'Template Folder',
        })

        self.env['res.config.settings'].create({
            'project_documents_template_folder': template_folder.id,
            'project_use_documents': True,
        }).execute()

        project_folder = self.project_pigs.documents_folder_id

        self.assertEqual(template_folder.description, project_folder.description, "The workspace of the project should be a copy of the template workspace.")
        self.assertTrue(project_folder.name == self.project_pigs.name and project_folder.company_id == self.project_pigs.company_id,
            "The copied workspace should have the same name and the same company as the project.")

        # Testing that the template folder will be an identical copy of the template is handled by the TestDocumentsFolder test in `documents`

    def test_bridge_project_project_settings_on_write(self):
        """
        Makes sure the settings apply their values when an document is assigned a res_model, res_id
        """

        attachment_txt_test = self.env['ir.attachment'].create({
            'datas': TEXT,
            'name': 'fileText_test.txt',
            'mimetype': 'text/plain',
        })
        attachment_gif_test = self.env['ir.attachment'].create({
            'datas': GIF,
            'name': 'fileText_test.txt',
            'mimetype': 'text/plain',
        })

        self.env['res.config.settings'].create({'project_use_documents': True}).execute()

        attachment_txt_test.write({
            'res_model': 'project.project',
            'res_id': self.project_pigs.id,
        })
        attachment_gif_test.write({
            'res_model': 'project.task',
            'res_id': self.task_1.id,
        })

        txt_doc = self.env['documents.document'].search([('attachment_id', '=', attachment_txt_test.id)])
        gif_doc = self.env['documents.document'].search([('attachment_id', '=', attachment_gif_test.id)])

        self.assertEqual(txt_doc.folder_id, self.project_pigs.documents_folder_id, 'the text test document should have a folder')
        self.assertEqual(gif_doc.folder_id, self.project_pigs.documents_folder_id, 'the gif test document should have a folder')

    def test_bridge_document_is_shared(self):
        """
        Tests that the `is_shared` computed field on `documents.document` is working as intended.
        """
        self.assertFalse(self.attachment_txt.is_shared, "The document should not be shared by default")

        share_link = self.env['documents.share'].create({
            'folder_id': self.folder_a_a.id,
            'include_sub_folders': False,
            'type': 'domain',
        })
        self.folder_a_a._compute_is_shared()
        self.attachment_txt._compute_is_shared()

        self.assertTrue(self.attachment_txt.is_shared, "The document should be shared by a link sharing its folder")

        share_link.write({
            'folder_id': self.folder_a.id,
            'include_sub_folders': True,
        })
        self.folder_a_a._compute_is_shared()
        self.attachment_txt._compute_is_shared()

        self.assertTrue(self.attachment_txt.is_shared, "The document should be shared by a link sharing on of its ancestor folders with the subfolders option enabled")
        # We assume the rest of the cases depending on whether the document folder is shared are handled by the TestDocumentsFolder test in `documents`

        share_link.write({
            'include_sub_folders': False,
            'type': 'ids',
            'document_ids': [Command.link(self.attachment_txt.id)],
        })
        self.folder_a_a._compute_is_shared()
        self.attachment_txt._compute_is_shared()

        self.assertFalse(self.folder_a_a.is_shared, "The folder should not be shared")
        self.assertTrue(self.attachment_txt.is_shared, "The document should be shared by a link sharing it by id")

        share_link.write({'date_deadline': date.today() + timedelta(days=-1)})
        self.attachment_txt._compute_is_shared()

        self.assertFalse(self.attachment_txt.is_shared, "The document should be shared by an expired link sharing it by id")

        share_link.write({'date_deadline': date.today() + timedelta(days=1)})
        self.attachment_txt._compute_is_shared()

        self.assertTrue(self.attachment_txt.is_shared, "The document should be shared by a link sharing it by id and not expired yet")
