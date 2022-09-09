from odoo.tests import tagged
from odoo.tests.common import HttpCase


@tagged('post_install', '-at_install')
class TestCRMDashboard(HttpCase):

    def test_leads_dashboard(self):
        self.start_tour('/web', 'spreadsheet_dashboard_leads', login='admin')

    def test_pipeline_dashboard(self):
        self.start_tour('/web', 'spreadsheet_dashboard_pipeline', login='admin')
