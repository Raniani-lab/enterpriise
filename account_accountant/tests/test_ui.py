# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import odoo.tests


@odoo.tests.tagged('-at_install', 'post_install')
class TestUi(odoo.tests.HttpCase):
    def test_accountant_tour(self):
        all_moves = self.env['account.move'].search([('move_type', '!=', 'entry')])
        all_moves.button_draft()
        all_moves.with_context(force_delete=True).unlink()
        self.start_tour("/web", 'account_accountant_tour', login="admin")
