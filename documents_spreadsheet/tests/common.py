# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase, new_test_user
from uuid import uuid4

TEST_CONTENT = "{}"
GIF = b"R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs="


class SpreadsheetTestCommon(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super(SpreadsheetTestCommon, cls).setUpClass()
        cls.folder = cls.env["documents.folder"].create({"name": "Test folder"})
        cls.spreadsheet_user = new_test_user(
            cls.env, login="spreadsheetDude", groups="documents.group_documents_user"
        )

    def create_spreadsheet(self, values=None, *, user=None, name="Untitled Spreadsheet"):
        if values is None:
            values = {}
        return (
            self.env["documents.document"]
            .with_user(user or self.env.user)
            .create({
                "spreadsheet_data": r"{}",
                "folder_id": self.folder.id,
                "handler": "spreadsheet",
                "mimetype": "application/o-spreadsheet",
                "name": name,
                **values,
            })
        )

    def get_revision(self, spreadsheet):
        return (
            # should be sorted by `create_date` but tests are so fast,
            # there are often no difference between consecutive revision creation.
            spreadsheet.with_context(active_test=False)
                .spreadsheet_revision_ids.sorted("id")[-1:]
                .revision_id or "START_REVISION"
        )

    def new_revision_data(self, spreadsheet, **kwargs):
        return {
            "id": spreadsheet.id,
            "type": "REMOTE_REVISION",
            "clientId": "john",
            "commands": [{"type": "A_COMMAND"}],
            "nextRevisionId": uuid4().hex,
            "serverRevisionId": self.get_revision(spreadsheet),
            **kwargs,
        }

    def snapshot(self, spreadsheet, server_revision_id, snapshot_revision_id, data):
        return spreadsheet.dispatch_spreadsheet_message({
            "type": "SNAPSHOT",
            "nextRevisionId": snapshot_revision_id,
            "serverRevisionId": server_revision_id,
            "data": data,
        })

    def share_spreadsheet(self, document):
        share = self.env["documents.share"].create(
            {
                "folder_id": document.folder_id.id,
                "document_ids": [(6, 0, [document.id])],
                "type": "ids",
            }
        )
        self.env["documents.shared.spreadsheet"].create(
            {
                "share_id": share.id,
                "document_id": document.id,
                "spreadsheet_data": document.spreadsheet_data,
            }
        )
        return share
