from odoo.tests.common import TransactionCase


class TestSpreadsheetDocumentToDashboard(TransactionCase):
    def test_create_wizard(self):
        group = self.env["spreadsheet.dashboard.group"].create(
            {"name": "a group"}
        )
        document = self.env["documents.document"].create(
            {
                "name": "a document",
                "raw": r'{"sheets": []}',
                "handler": "spreadsheet",
                "mimetype": "application/o-spreadsheet",
            }
        )
        wizard = self.env["spreadsheet.document.to.dashboard"].create(
            {
                "name": "a dashboard",
                "document_id": document.id,
                "dashboard_group_id": group.id,
                "group_ids": self.env.ref("documents.group_documents_user")
            }
        )
        next_action = wizard.create_dashboard()
        dashboard_id = next_action["params"]["dashboard_id"]
        dashboard = self.env["spreadsheet.dashboard"].browse(dashboard_id)
        self.assertEqual(dashboard.name, "a dashboard")
        self.assertEqual(dashboard.group_ids, self.env.ref("documents.group_documents_user"))
        self.assertEqual(dashboard.dashboard_group_id, group)
        self.assertEqual(
            dashboard.raw,
            b'{"sheets": []}',
        )
        self.assertEqual(
            next_action,
            {
                "type": "ir.actions.client",
                "tag": "action_spreadsheet_dashboard",
                "name": "a dashboard",
                "params": {
                    "dashboard_id": dashboard_id,
                },
            },
        )

    def test_create_wizard_with_default_values(self):
        group = self.env["spreadsheet.dashboard.group"].create(
            {"name": "a group"}
        )
        document = self.env["documents.document"].create(
            {
                "name": "a document",
                "raw": r'{"sheets": []}',
                "handler": "spreadsheet",
                "mimetype": "application/o-spreadsheet",
            }
        )
        wizard = self.env["spreadsheet.document.to.dashboard"].create(
            {
                "document_id": document.id,
                "dashboard_group_id": group.id,
            }
        )
        next_action = wizard.create_dashboard()
        dashboard_id = next_action["params"]["dashboard_id"]
        dashboard = self.env["spreadsheet.dashboard"].browse(dashboard_id)
        self.assertEqual(dashboard.name, "a document")
        self.assertEqual(dashboard.group_ids, self.env.ref("base.group_user"))
        self.assertEqual(dashboard.dashboard_group_id, group)
        self.assertEqual(
            dashboard.raw,
            b'{"sheets": []}',
        )
        self.assertEqual(
            next_action,
            {
                "type": "ir.actions.client",
                "tag": "action_spreadsheet_dashboard",
                "name": "a document",
                "params": {
                    "dashboard_id": dashboard_id,
                },
            },
        )
