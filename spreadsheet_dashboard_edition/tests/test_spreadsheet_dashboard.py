from odoo.tests.common import TransactionCase


class TestSpreadsheetDashboard(TransactionCase):

    def test_computed_name(self):
        group = self.env["spreadsheet.dashboard.group"].create(
            {"name": "a group"}
        )
        dashboard = self.env["spreadsheet.dashboard"].create(
            {
                "name": "My Dashboard",
                "dashboard_group_id": group.id,
                "spreadsheet_data": "{}",
            }
        )
        self.assertEqual(dashboard.file_name, "My Dashboard.osheet.json")
