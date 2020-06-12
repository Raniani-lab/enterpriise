# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.fields import Date, Datetime
from odoo.exceptions import AccessError
from odoo.tests.common import SavepointCase, new_test_user


class SpreadsheetDocuments(SavepointCase):

    @classmethod
    def setUpClass(cls):
        super(SpreadsheetDocuments, cls).setUpClass()
        cls.folder = cls.env["documents.folder"].create({"name": "Test folder"})

    def test_spreadsheet_to_display(self):
        document = self.env["documents.document"].create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        archived_document = self.env["documents.document"].create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "active": False,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        spreadsheets = self.env["documents.document"].get_spreadsheets_to_display()
        spreadsheet_ids = [s["id"] for s in spreadsheets]
        self.assertTrue(document.id in spreadsheet_ids, "It should contain the new document")
        self.assertFalse(archived_document.id in spreadsheet_ids, "It should not contain the archived document")

    def test_spreadsheet_to_display_access_portal(self):
        portal = new_test_user(self.env, "Test user", groups='base.group_portal')
        with self.assertRaises(AccessError, msg="A portal user should not be able to read spreadsheet"):
            self.env["documents.document"].with_user(portal).get_spreadsheets_to_display()

    def test_spreadsheet_to_display_access_ir_rule(self):
        user = new_test_user(self.env, "Test user", groups='documents.group_documents_manager')

        model = self.env.ref('documents.model_documents_document')
        group = self.env.ref('documents.group_documents_manager')

        self.env["documents.document"].with_user(user).create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        # archive existing record rules which might allow access (disjunction between record rules)
        record_rules = self.env['ir.rule'].search([
            ('model_id', '=', model.id),
        ])
        record_rules.active = False
        self.env['ir.rule'].create({
            'name': 'test record rule',
            'model_id': model.id,
            'groups': [(4, group.id)],
            'domain_force': "[('id', '=', -9999)]", # always rejects
        })
        with self.assertRaises(AccessError, msg="record rule should have raised"):
            self.env["documents.document"].with_user(user).get_spreadsheets_to_display()

    def test_spreadsheet_to_display_access_field_groups(self):
        existing_groups = self.env['documents.document']._fields['name'].groups
        self.env['documents.document']._fields['name'].groups = "base.group_system"
        user = new_test_user(self.env, "Test user", groups='documents.group_documents_manager')

        with self.assertRaises(AccessError, msg="field should be protected"):
            self.env["documents.document"].with_user(user).get_spreadsheets_to_display()
        self.env['documents.document']._fields['name'].groups = existing_groups
