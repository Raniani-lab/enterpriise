# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
from .common import SpreadsheetTestCommon


TEXT = base64.b64encode(bytes("TEST", 'utf-8'))

class SpreadsheetTemplate(SpreadsheetTestCommon):

    def test_copy_template_without_name(self):
        template = self.env["spreadsheet.template"].create({
            "data": TEXT,
            "name": "Template name",
        })
        self.assertEqual(
            template.copy().name,
            "Template name (copy)",
            "It should mention the template is a copy"
        )

    def test_copy_template_with_name(self):
        template = self.env["spreadsheet.template"].create({
            "data": TEXT,
            "name": "Template name",
        })
        self.assertEqual(
            template.copy({"name": "New Name"}).name,
            "New Name",
            "It should have assigned the given name"
        )

    def test_allow_write_on_own_template(self):
        template = self.env["spreadsheet.template"].with_user(self.spreadsheet_user)\
            .create({
                "data": TEXT,
                "name": "Template name",
            })
        self.assertFalse(
            template.fetch_template_data()["isReadonly"],
            "Document User should be able to edit his own templates"
        )

    def test_forbid_write_on_others_template(self):
        template = self.env["spreadsheet.template"].create({
            "data": TEXT,
            "name": "Template name",
        })
        self.assertTrue(
            template.with_user(self.spreadsheet_user).fetch_template_data()["isReadonly"],
            "Document User cannot edit other's templates"
        )

    def test_action_create_spreadsheet(self):
        template = self.env["spreadsheet.template"].create({
            "data": TEXT,
            "name": "Template name",
        })
        action = template.action_create_spreadsheet()
        spreadsheet_id = action["params"]["spreadsheet_id"]
        document = self.env["documents.document"].browse(spreadsheet_id)
        self.assertTrue(document.exists())
        self.assertEqual(document.handler, "spreadsheet")
        self.assertEqual(document.mimetype, "application/o-spreadsheet")
        self.assertEqual(document.name, "Template name")
        self.assertEqual(document.datas, TEXT)
        self.assertEqual(action["type"], "ir.actions.client")
        self.assertEqual(action["tag"], "action_open_spreadsheet")
        self.assertTrue(action["params"]["convert_from_template"])

    def test_action_create_spreadsheet_in_folder(self):
        template = self.env["spreadsheet.template"].create({
            "data": TEXT,
            "name": "Template name",
        })
        action = template.action_create_spreadsheet({
            "folder_id": self.folder.id
        })
        spreadsheet_id = action["params"]["spreadsheet_id"]
        document = self.env["documents.document"].browse(spreadsheet_id)
        self.assertEqual(document.folder_id, self.folder)
