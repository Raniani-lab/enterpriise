# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import odoo.tests
from odoo import tools


@odoo.tests.tagged('-at_install', 'post_install')
class TestUi(odoo.tests.HttpCase):
    def test_ui(self):
        if tools.config["without_demo"]:
            self.skipTest("This test is stronly relying on demo data, and should be adapted")
        self.start_tour("/web", 'account_reports_widgets', login='admin')
