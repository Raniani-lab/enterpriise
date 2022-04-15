# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.crm.tests import common as crm_common
from odoo.tests.common import users


class TestLead(crm_common.TestCrmCommon):

    @users('user_sales_leads')
    def test_rental_fields(self):
        lead = self.env['crm.lead'].browse(self.lead_1.ids)
        rental_product = self.env['product.product'].sudo().create({
            'extra_daily': 10,
            'extra_hourly': 5,
            'list_price': 100,
            'name': 'Rent Product',
            'rent_ok': True,
            'type': 'consu',
            'product_pricing_ids': self.env['product.pricing'].sudo().create({
                'duration': 1,
                'unit': 'day',
                'price': 100,
            }),
        })

        base_order_vals = {
            'is_rental_order': True,
            'order_line': [
                (0, 0, {'product_id': rental_product.id,
                        'product_uom_qty': 2,
                       }
                )],
            'opportunity_id': lead.id,
            'partner_id': self.contact_1.id,
        }

        orders = self.env['sale.order'].create([
            dict(base_order_vals),
            dict(base_order_vals),
            dict(base_order_vals)
        ])
        orders[0:2].action_unlock()
        orders[1].action_confirm()
        orders.flush()

        self.assertEqual(lead.rental_quotation_count, 1)
        self.assertEqual(lead.rental_order_count, 2)
        self.assertEqual(lead.rental_amount_total, 2*2*100)
