# Part of Odoo. See LICENSE file for full copyright and licensing details.
# -*- coding: utf-8 -*-

import odoo.tests


@odoo.tests.tagged('post_install', '-at_install')
class TestUi(odoo.tests.HttpCase):
    def test_ui(self):

        self.env['product.product'].create({
            'name': 'Bolt - Test',
            'standard_price': 0.5,
            'list_price': 0.5,
            'type': 'consu',
        })
        self.env['res.partner'].create({'name': 'Leroy Philippe', 'email': 'leroy.philou@example.com'})
        self.start_tour("/web", 'industry_fsm_tour', login="admin")
