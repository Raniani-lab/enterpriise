# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.spreadsheet_edition.tests.spreadsheet_test_case import SpreadsheetTestCase


class SpreadsheetMixinTest(SpreadsheetTestCase):


    def test_copy_revisions(self):
        spreadsheet = self.env["spreadsheet.test"].create({})
        spreadsheet.dispatch_spreadsheet_message(self.new_revision_data(spreadsheet))
        copy = spreadsheet.copy()
        self.assertEqual(
            copy.spreadsheet_revision_ids.commands,
            spreadsheet.spreadsheet_revision_ids.commands,
        )

    def test_dont_copy_revisions_if_provided(self):
        spreadsheet = self.env["spreadsheet.test"].create({})
        spreadsheet.dispatch_spreadsheet_message(self.new_revision_data(spreadsheet))
        copy = spreadsheet.copy({"spreadsheet_revision_ids": []})
        self.assertFalse(copy.spreadsheet_revision_ids)
