# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase
from uuid import uuid4


class SpreadsheetTestCase(TransactionCase):

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
