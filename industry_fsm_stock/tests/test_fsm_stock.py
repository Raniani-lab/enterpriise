# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo.addons.industry_fsm_sale.tests.test_industry_fsm_sale_flow import TestFsmFlowSale


class TestFsmFlowStock(TestFsmFlowSale):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        (cls.product_ordered + cls.product_delivered).write({'type': 'product'})
        cls.product_lot = cls.env['product.product'].create({
            'name': 'Acoustic Magic Bloc',
            'list_price': 2950.0,
            'type': 'product',
            'invoice_policy': 'delivery',
            'taxes_id': False,
            'tracking': 'lot',
        })

        cls.lot_id1 = cls.env['stock.production.lot'].create({
            'product_id': cls.product_lot.id,
            'name': "Lot_1",
            'company_id': cls.env.company.id,
        })

        cls.lot_id2 = cls.env['stock.production.lot'].create({
            'product_id': cls.product_lot.id,
            'name': "Lot_2",
            'company_id': cls.env.company.id,
        })

        cls.lot_id3 = cls.env['stock.production.lot'].create({
            'product_id': cls.product_lot.id,
            'name': "Lot_3",
            'company_id': cls.env.company.id,
        })

        cls.warehouse = cls.env['stock.warehouse'].search([('company_id', '=', cls.env.user.id)], limit=1)
        inventory = cls.env['stock.inventory'].create({
            'name': 'Initial inventory',
            'line_ids': [(0, 0, {
                'product_id': cls.product_lot.id,
                'product_uom_id': cls.product_lot.uom_id.id,
                'product_qty': 4,
                'prod_lot_id': cls.lot_id1.id,
                'location_id': cls.warehouse.lot_stock_id.id
            }), (0, 0, {
                'product_id': cls.product_lot.id,
                'product_uom_id': cls.product_lot.uom_id.id,
                'product_qty': 2,
                'prod_lot_id': cls.lot_id2.id,
                'location_id': cls.warehouse.lot_stock_id.id
            }), (0, 0, {
                'product_id': cls.product_lot.id,
                'product_uom_id': cls.product_lot.uom_id.id,
                'product_qty': 2,
                'prod_lot_id': cls.lot_id3.id,
                'location_id': cls.warehouse.lot_stock_id.id
            })]
        })
        inventory.action_start()
        inventory.action_validate()

    def test_fsm_flow(self):
        '''
            3 delivery step
            1. Add product and lot on SO
            2. Check that default lot on picking are not the same as chosen on SO
            3. Validate fsm task
            4. Check that lot on validated picking are the same as chosen on SO
        '''
        self.warehouse.delivery_steps = 'pick_pack_ship'

        self.task.write({'partner_id': self.partner_1.id})
        self.task.with_user(self.project_user)._fsm_ensure_sale_order()
        self.task.sale_order_id.write({
            'order_line': [
                (0, 0, {
                    'product_id': self.product_lot.id,
                    'product_uom_qty': 3,
                    'fsm_lot_id': self.lot_id2.id,
                })
            ]
        })
        self.task.sale_order_id.action_confirm()

        move = self.task.sale_order_id.order_line.move_ids
        while move.move_orig_ids:
            move = move.move_orig_ids
        self.assertNotEqual(move.move_line_ids.lot_id, self.lot_id2, "Lot automatically added on move lines is not the same as asked. (By default, it's the first lot available)")
        self.task.with_user(self.project_user).action_fsm_validate()
        self.assertEqual(move.move_line_ids.lot_id, self.lot_id2, "Asked lots are added on move lines.")
        self.assertEqual(move.move_line_ids.qty_done, 3, "We deliver 3 (even they are only 2 in stock)")

        self.assertEqual(self.task.sale_order_id.picking_ids.mapped('state'), ['done', 'done', 'done'], "Pickings should be set as done")

    def test_fsm_stock_already_validated_picking(self):
        '''
            1 delivery step
            1. add product and lot on SO
            2. Validate picking with another lot
            3. Open wizard for lot, and ensure that the lot validated is the one chosen in picking
            4. Add a new lot and quantity in wizard
            5. Validate fsm task
            6. Ensure that lot and quantity are correct
        '''
        self.warehouse.delivery_steps = 'ship_only'

        self.task.write({'partner_id': self.partner_1.id})
        self.task.with_user(self.project_user)._fsm_ensure_sale_order()
        self.task.sale_order_id.write({
            'order_line': [
                (0, 0, {
                    'product_id': self.product_lot.id,
                    'product_uom_qty': 1,
                    'fsm_lot_id': self.lot_id2.id,
                })
            ]
        })
        self.task.sale_order_id.action_confirm()

        wizard = self.product_lot.with_context({'fsm_task_id': self.task.id}).action_assign_serial()
        wizard_id = self.env['fsm.stock.tracking'].browse(wizard['res_id'])
        self.assertFalse(wizard_id.tracking_validated_line_ids, "There aren't validated line")
        self.assertEqual(wizard_id.tracking_line_ids.product_id, self.product_lot, "There are one line with the right product")
        self.assertEqual(wizard_id.tracking_line_ids.lot_id, self.lot_id2, "The line has lot_id2")

        move = self.task.sale_order_id.order_line.move_ids
        move.quantity_done = 1
        picking_ids = self.task.sale_order_id.picking_ids
        picking_ids.with_context(skip_sms=True, cancel_backorder=True).button_validate()
        self.assertEqual(picking_ids.mapped('state'), ['done'], "Pickings should be set as done")
        self.assertNotEqual(move.move_line_ids.lot_id, self.lot_id2, "Lot automatically added on move lines is not the same as asked. (By default, it's the first lot available)")

        wizard = self.product_lot.with_context({'fsm_task_id': self.task.id}).action_assign_serial()
        wizard_id = self.env['fsm.stock.tracking'].browse(wizard['res_id'])
        self.assertFalse(wizard_id.tracking_line_ids, "There aren't line to validate")
        self.assertEqual(wizard_id.tracking_validated_line_ids.product_id, self.product_lot, "There are one line with the right product")
        self.assertEqual(wizard_id.tracking_validated_line_ids.lot_id, self.lot_id1, "The line has lot_id1, (not the lot choosed at the beginning, but the lot put in picking)")

        wizard_id.write({
            'tracking_line_ids': [
                (0, 0, {
                    'product_id': self.product_lot.id,
                    'quantity': 3,
                    'lot_id': self.lot_id3.id,
                })
            ]
        })
        wizard_id.generate_lot()

        self.task.with_user(self.project_user).action_fsm_validate()
        order_line_ids = self.task.sale_order_id.order_line.filtered(lambda l: l.product_id == self.product_lot)
        move = order_line_ids.move_ids
        self.assertEqual(len(order_line_ids), 2, "There are 2 order lines.")
        self.assertEqual(move.move_line_ids.lot_id, self.lot_id1 + self.lot_id3, "Lot stay the same.")
        self.assertEqual(sum(move.move_line_ids.mapped('qty_done')), 4, "We deliver 4 (1+3)")

        self.assertEqual(self.task.sale_order_id.picking_ids.mapped('state'), ['done', 'done'], "The 2 pickings should be set as done")
