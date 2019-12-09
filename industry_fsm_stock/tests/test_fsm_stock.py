# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo.addons.industry_fsm_sale.tests.test_industry_fsm_sale_flow import TestFsmFlowSale

class TestFsmFlowStock(TestFsmFlowSale):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        (cls.product_ordered + cls.product_delivered).write({'type': 'product'})

    def test_fsm_flow(self):
        warehouse = self.env['stock.warehouse'].search([('company_id', '=', self.env.user.id)], limit=1)
        inventory = self.env['stock.inventory'].create({
            'name': 'Initial inventory',
            'line_ids': [(0, 0, {
                'product_id': self.product_ordered.id,
                'product_uom_id': self.product_ordered.uom_id.id,
                'product_qty': 500,
                'location_id': warehouse.lot_stock_id.id
            }), (0, 0, {
                'product_id': self.product_delivered.id,
                'product_uom_id': self.product_delivered.uom_id.id,
                'product_qty': 500,
                'location_id': warehouse.lot_stock_id.id
            })]
        })
        inventory.action_start()
        inventory.action_validate()

        super().test_fsm_flow()
        self.assertEqual(self.task.sale_order_id.picking_ids.mapped('state'), ['done'], "Pickings should be set as done")
