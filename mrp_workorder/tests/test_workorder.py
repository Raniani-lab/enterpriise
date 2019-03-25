# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.mrp.tests import common
from odoo.tests import Form
from odoo.exceptions import UserError


class TestWorkOrder(common.TestMrpCommon):
    @classmethod
    def setUpClass(cls):
        super(TestWorkOrder, cls).setUpClass()
        # Products and lots
        cls.submarine_pod = cls.env['product.product'].create({
            'name': 'Submarine pod',
            'type': 'product',
            'tracking': 'serial'})
        cls.sp1 = cls.env['stock.production.lot'].create({
            'product_id': cls.submarine_pod.id,
            'name': 'sp1'})
        cls.sp2 = cls.env['stock.production.lot'].create({
            'product_id': cls.submarine_pod.id,
            'name': 'sp2'})
        cls.sp3 = cls.env['stock.production.lot'].create({
            'product_id': cls.submarine_pod.id,
            'name': 'sp3'})
        cls.elon_musk = cls.env['product.product'].create({
            'name': 'Elon Musk',
            'type': 'product',
            'tracking': 'serial'})
        cls.elon1 = cls.env['stock.production.lot'].create({
            'product_id': cls.elon_musk.id,
            'name': 'elon1'})
        cls.elon2 = cls.env['stock.production.lot'].create({
            'product_id': cls.elon_musk.id,
            'name': 'elon2'})
        cls.elon3 = cls.env['stock.production.lot'].create({
            'product_id': cls.elon_musk.id,
            'name': 'elon3'})
        cls.metal_cylinder = cls.env['product.product'].create({
            'name': 'Metal cylinder',
            'type': 'product',
            'tracking': 'lot'})
        cls.mc1 = cls.env['stock.production.lot'].create({
            'product_id': cls.metal_cylinder.id,
            'name': 'mc1'})
        cls.trapped_child = cls.env['product.product'].create({
            'name': 'Trapped child',
            'type': 'product',
            'tracking': 'none'})
        # Bill of material
        cls.bom_submarine = cls.env['mrp.bom'].create({
            'product_tmpl_id': cls.submarine_pod.product_tmpl_id.id,
            'product_qty': 1.0,
            'routing_id': cls.routing_2.id})
        cls.env['mrp.bom.line'].create({
            'product_id': cls.elon_musk.id,
            'product_qty': 1.0,
            'bom_id': cls.bom_submarine.id,
            'operation_id': cls.operation_3.id})
        cls.env['mrp.bom.line'].create({
            'product_id': cls.trapped_child.id,
            'product_qty': 12.0,
            'bom_id': cls.bom_submarine.id})
        cls.env['mrp.bom.line'].create({
            'product_id': cls.metal_cylinder.id,
            'product_qty': 2.0,
            'bom_id': cls.bom_submarine.id,
            'operation_id': cls.operation_2.id})
        cls.operation_4 = cls.env['mrp.routing.workcenter'].create({
            'name': 'Rescue operation',
            'workcenter_id': cls.workcenter_1.id,
            'routing_id': cls.routing_2.id,
            'time_cycle': 13,
            'sequence': 2})

        # Update quantities
        Quant = cls.env['stock.quant']
        Quant._update_available_quantity(cls.elon_musk, cls.location_1, 1.0, lot_id=cls.elon1)
        Quant._update_available_quantity(cls.elon_musk, cls.location_1, 1.0, lot_id=cls.elon2)
        Quant._update_available_quantity(cls.elon_musk, cls.location_1, 1.0, lot_id=cls.elon3)
        Quant._update_available_quantity(cls.metal_cylinder, cls.location_1, 2.0, lot_id=cls.mc1)
        Quant._update_available_quantity(cls.trapped_child, cls.location_1, 12.0)

    def test_workorder_1(self):
        # get the computer sc234 demo data
        prod = self.env.ref('product.product_product_3')
        bom = self.env.ref('mrp.mrp_bom_manufacture')

        # create a manufacturing order for it
        mo = self.env['mrp.production'].create({
            'product_id': prod.id,
            'product_uom_id': prod.uom_id.id,
            'bom_id': bom.id,
            'product_qty': 1,
        })

        # plan the work orders
        mo.button_plan()

    def test_assign_1(self):
        unit = self.ref("uom.product_uom_unit")
        self.stock_location = self.env.ref('stock.stock_location_stock')
        custom_laptop = self.env.ref("product.product_product_27")
        custom_laptop.tracking = 'none'
        product_charger = self.env['product.product'].create({
            'name': 'Charger',
            'type': 'product',
            'tracking': 'lot',
            'uom_id': unit,
            'uom_po_id': unit})
        product_keybord = self.env['product.product'].create({
            'name': 'Usb Keybord',
            'type': 'product',
            'uom_id': unit,
            'uom_po_id': unit})
        bom_custom_laptop = self.env['mrp.bom'].create({
            'product_tmpl_id': custom_laptop.product_tmpl_id.id,
            'product_qty': 1,
            'product_uom_id': unit,
            'routing_id': self.env.ref('mrp.mrp_routing_0').id,
            'bom_line_ids': [(0, 0, {
                'product_id': product_charger.id,
                'product_qty': 1,
                'product_uom_id': unit
            }), (0, 0, {
                'product_id': product_keybord.id,
                'product_qty': 1,
                'product_uom_id': unit
            })]
        })

        production_form = Form(self.env['mrp.production'])
        production_form.product_id = custom_laptop
        production_form.bom_id = bom_custom_laptop
        production_form.product_qty = 2
        production = production_form.save()
        production.action_confirm()
        production.button_plan()
        workorder = production.workorder_ids
        self.assertTrue(workorder)

        self.assertEqual(len(workorder.workorder_line_ids), 2)
        wl_charger = workorder.workorder_line_ids.filtered(lambda wl: wl.product_id == product_charger)
        self.assertEqual(wl_charger.qty_done, 0)
        self.assertEqual(wl_charger.qty_reserved, 0)
        self.assertEqual(wl_charger.qty_to_consume, 2)
        wl_keybord = workorder.workorder_line_ids.filtered(lambda wl: wl.product_id == product_keybord)
        self.assertEqual(wl_keybord.qty_done, 2)
        self.assertEqual(wl_keybord.qty_reserved, 0)
        self.assertEqual(wl_keybord.qty_to_consume, 2)

        self.env['stock.quant']._update_available_quantity(product_charger, self.stock_location, 5)
        self.env['stock.quant']._update_available_quantity(product_keybord, self.stock_location, 5)

        production.action_assign()
        wl_charger = workorder.workorder_line_ids.filtered(lambda wl: wl.product_id == product_charger)
        wl_keybord = workorder.workorder_line_ids.filtered(lambda wl: wl.product_id == product_keybord)
        self.assertEqual(len(workorder.workorder_line_ids), 2)
        self.assertEqual(wl_charger.qty_done, 0)
        self.assertEqual(wl_charger.qty_reserved, 2)
        self.assertEqual(wl_charger.qty_to_consume, 2)
        self.assertEqual(wl_keybord.qty_done, 2)
        self.assertEqual(wl_keybord.qty_reserved, 0)
        self.assertEqual(wl_keybord.qty_to_consume, 2)

    def test_flexible_consumption_1(self):
        """ Production with a strict consumption
        Check that consuming a tracked product more than planned triggers an error"""
        self.bom_submarine.consumption = 'strict'

        mo_form = Form(self.env['mrp.production'])
        mo_form.product_id = self.submarine_pod
        mo_form.bom_id = self.bom_submarine
        mo_form.product_qty = 1
        mo = mo_form.save()

        mo.action_assign()
        mo.action_confirm()
        mo.button_plan()

        wo = mo.workorder_ids[0]
        wo.button_start()
        wo_form = Form(wo, view='mrp_workorder.mrp_workorder_view_form_tablet')
        wo_form.final_lot_id = self.sp1
        wo_form.lot_id = self.mc1
        with self.assertRaises(UserError):
            # try consume more with strict BoM
            wo_form.qty_done = 10
            wo = wo_form.save()
            wo._next()

    def test_flexible_consumption_1b(self):
        """ Production with a strict consumption
        Check that consuming a non tracked product more than planned triggers an error"""
        self.env['quality.point'].create({
            'product_id': self.submarine_pod.id,
            'product_tmpl_id': self.submarine_pod.product_tmpl_id.id,
            'picking_type_id': self.env['stock.picking.type'].search([('code', '=', 'mrp_operation')], limit=1).id,
            'operation_id': self.operation_2.id,
            'test_type_id': self.env.ref('mrp_workorder.test_type_register_consumed_materials').id,
            'component_id': self.trapped_child.id,
        })
        self.submarine_pod.tracking = 'lot'
        self.bom_submarine.bom_line_ids.filtered(lambda line: line.product_id == self.trapped_child).operation_id = self.operation_2

        mo_form = Form(self.env['mrp.production'])
        mo_form.product_id = self.submarine_pod
        mo_form.bom_id = self.bom_submarine
        mo_form.product_qty = 2
        mo = mo_form.save()

        mo.action_assign()
        mo.action_confirm()
        mo.button_plan()

        wo = mo.workorder_ids[0]
        wo.button_start()
        wo_form = Form(wo, view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.component_id, self.trapped_child, 'The suggested component is wrong')
        self.assertEqual(wo_form.qty_done, 24, 'The suggested component qty_done is wrong')
        self.assertEqual(wo_form.component_remaining_qty, 24, 'The remaining quantity is wrong')
        # check the onchange on qty_producing is working
        wo_form.qty_producing = 1
        self.assertEqual(wo_form.component_remaining_qty, 12, 'The remaining quantity is wrong')
        wo_form.qty_producing = 2
        self.assertEqual(wo_form.component_remaining_qty, 24, 'The remaining quantity is wrong')
        wo_form.qty_done = 12
        wo = wo_form.save()
        wo.action_continue()
        # Check the remaining quantity is well computed
        wo_form = Form(wo, view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.qty_done, 12, 'The suggested component qty_done is wrong')
        self.assertEqual(wo_form.component_remaining_qty, 12, 'The remaining quantity is wrong')

        with self.assertRaises(UserError):
            # try consume more with strict BoM
            wo_form.qty_done = 30
            wo = wo_form.save()
            wo._next()

    def test_flexible_consumption_1c(self):
        """ Production with a strict consumption
        Check that consuming the right amount of component doens't trigger any error"""

        self.env['quality.point'].create({
            'product_id': self.submarine_pod.id,
            'product_tmpl_id': self.submarine_pod.product_tmpl_id.id,
            'picking_type_id': self.env['stock.picking.type'].search([('code', '=', 'mrp_operation')], limit=1).id,
            'operation_id': self.operation_2.id,
            'test_type_id': self.env.ref('mrp_workorder.test_type_register_consumed_materials').id,
            'component_id': self.trapped_child.id,
        })
        self.bom_submarine.bom_line_ids.filtered(lambda line: line.product_id == self.trapped_child).operation_id = self.operation_2
        mo_form = Form(self.env['mrp.production'])
        mo_form.product_id = self.submarine_pod
        mo_form.bom_id = self.bom_submarine
        mo_form.product_qty = 1
        mo = mo_form.save()

        mo.action_assign()
        mo.action_confirm()
        mo.button_plan()

        wo = mo.workorder_ids[0]
        wo.button_start()
        wo_form = Form(wo, view='mrp_workorder.mrp_workorder_view_form_tablet')
        wo_form.final_lot_id = self.sp1
        wo_form.qty_done = 6
        wo = wo_form.save()
        wo.action_continue()
        wo_form = Form(wo, view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.component_id, self.trapped_child, 'The suggested component is wrong')
        wo_form.qty_done = 6
        wo = wo_form.save()
        wo._next()
        wo_form = Form(wo, view='mrp_workorder.mrp_workorder_view_form_tablet')
        wo_form.lot_id = self.mc1
        wo_form.qty_done = 1
        wo = wo_form.save()
        wo.action_continue()
        wo_form = Form(wo, view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.component_id, self.metal_cylinder, 'The suggested component is wrong')
        wo_form.qty_done = 1
        wo_form.lot_id = self.mc1
        wo = wo_form.save()
        wo._next()
        wo.do_finish()

        wo = mo.workorder_ids[1]
        wo.button_start()
        wo_form = Form(wo, view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.final_lot_id, self.sp1, 'The suggested final product is wrong')
        self.assertEqual(wo_form.qty_done, 1, 'The suggested qty_done should be one as the component is a serial number')
        # try to write on readonly field
        with self.assertRaises(AssertionError):
            wo_form.qty_done = 2
        wo_form.lot_id = self.elon1
        wo = wo_form.save()
        wo._next()
        wo.do_finish()

        wo = mo.workorder_ids[2]
        wo.button_start()
        self.assertEqual(wo.final_lot_id, self.sp1, 'The suggested final product is wrong')
        wo.do_finish()

        mo.button_mark_done()
        self.assertEqual(mo.state, 'done', 'Final state of the MO should be "done"')

    def test_flexible_consumption_2(self):
        """ Production with a flexible consumption
        Check that consuming different quantities than planned doensn't trigger
        any error"""
        self.bom_submarine.consumption = 'flexible'

        mo_form = Form(self.env['mrp.production'])
        mo_form.product_id = self.submarine_pod
        mo_form.bom_id = self.bom_submarine
        mo_form.product_qty = 1
        mo = mo_form.save()

        mo.action_assign()
        mo.action_confirm()
        mo.button_plan()

        wo = mo.workorder_ids[0]
        wo.button_start()
        wo.final_lot_id = self.sp1
        wo.lot_id = self.mc1
        wo.qty_done = 1
        wo._next()
        wo.do_finish()

        wo = mo.workorder_ids[1]
        wo.button_start()
        self.assertEqual(wo.final_lot_id, self.sp1, 'The suggested final product is wrong')
        wo.lot_id = self.elon1
        wo.action_continue()
        wo.lot_id = self.elon2
        wo._next()
        wo.do_finish()

        wo = mo.workorder_ids[2]
        wo.button_start()
        self.assertEqual(wo.final_lot_id, self.sp1, 'The suggested final product is wrong')
        wo.do_finish()

        mo.button_mark_done()
        move_1 = mo.move_raw_ids.filtered(lambda move: move.product_id == self.metal_cylinder and move.state == 'done')
        self.assertEqual(sum(move_1.mapped('quantity_done')), 1, 'Only one cylinder was consumed')
        move_2 = mo.move_raw_ids.filtered(lambda move: move.product_id == self.elon_musk and move.state == 'done')
        self.assertEqual(sum(move_2.mapped('quantity_done')), 2, '2 Elon Musk was consumed')
        move_3 = mo.move_raw_ids.filtered(lambda move: move.product_id == self.trapped_child and move.state == 'done')
        self.assertEqual(sum(move_3.mapped('quantity_done')), 12, '12 child was consumed')
        self.assertEqual(mo.state, 'done', 'Final state of the MO should be "done"')

    def test_workorder_reservation_1(self):
        # Test multiple final lots management
        mrp_order_form = Form(self.env['mrp.production'])
        mrp_order_form.product_id = self.submarine_pod
        mrp_order_form.product_qty = 1
        production = mrp_order_form.save()

        production.action_confirm()
        production.action_assign()
        production.button_plan()
        wo = production.workorder_ids[0]
        wo_form = Form(wo, view='mrp_workorder.mrp_workorder_view_form_tablet')
        wo_form.final_lot_id = self.sp1
        self.assertEqual(wo_form.lot_id, self.mc1, "component lot should be prefilled")
        self.assertEqual(wo_form.qty_done, 2, "component quantity should be prefilled")
        wo = wo_form.save()
        wo._next()
        wo.record_production()
        wo = production.workorder_ids[1]
        wo_form = Form(wo, view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.lot_id, self.elon1, "component lot should be prefilled")
        self.assertEqual(wo_form.qty_done, 1, "component quantity should be prefilled")
        wo = wo_form.save()
        wo._next()
        wo.record_production()
        wo = production.workorder_ids[2]
        wo_form = Form(wo, view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.final_lot_id, self.sp1, "final lot should be prefilled")
        wo = wo_form.save()
        wo.do_finish()
        production.button_mark_done()

        move_elon = production.move_raw_ids.filtered(lambda move: move.product_id == self.elon_musk)
        self.assertEqual(move_elon.state, 'done', 'Move should be done')
        self.assertEqual(move_elon.quantity_done, 1, 'Consumed quantity should be 2')
        self.assertEqual(len(move_elon.move_line_ids), 1, 'their should be 2 move lines')
        self.assertEqual(move_elon.move_line_ids.lot_id, self.elon1, 'Wrong serial number used')
        move_cylinder = production.move_raw_ids.filtered(lambda move: move.product_id == self.metal_cylinder)
        self.assertEqual(move_cylinder.state, 'done', 'Move should be done')
        self.assertEqual(move_cylinder.quantity_done, 2, 'Consumed quantity should be 4')
        move_child = production.move_raw_ids.filtered(lambda move: move.product_id == self.trapped_child)
        self.assertEqual(move_child.state, 'done', 'Move should be done')
        self.assertEqual(move_child.quantity_done, 12, 'Consumed quantity should be 24')

    def test_workorder_reservation_2(self):
        # Test multiple final product tracked by sn and all consumption in the same
        # workorder.

        # Also test assignment after workorder planning

        self.bom_submarine.bom_line_ids.write({'operation_id': False})
        self.bom_submarine.routing_id = self.env.ref('mrp.mrp_routing_0')

        mrp_order_form = Form(self.env['mrp.production'])
        mrp_order_form.product_id = self.submarine_pod
        mrp_order_form.product_qty = 2
        production = mrp_order_form.save()

        production.action_confirm()
        production.button_plan()
        production.action_assign()
        wo_form = Form(production.workorder_ids, view='mrp_workorder.mrp_workorder_view_form_tablet')
        wo_form.final_lot_id = self.sp1
        self.assertEqual(wo_form.lot_id, self.elon1, "component lot should be prefilled")
        self.assertEqual(wo_form.qty_done, 1, "component quantity should be 1 as final product is tracked")
        self.assertEqual(wo_form.component_remaining_qty, 1, "It needs 2 component")
        self.assertEqual(wo_form.qty_producing, 1, "Quantity to produce should prefilled with 1 (serial tracked product)")
        wo = wo_form.save()
        wo._next()
        wo_form = Form(production.workorder_ids, view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.lot_id, self.mc1, "workorder should consume the second product")
        self.assertEqual(wo_form.qty_done, 2, "Quantity to consume should prefilled with 2")
        self.assertEqual(wo_form.component_id, self.metal_cylinder, "workorder should be consume the second product")
        wo = wo_form.save()
        wo._next()
        wo.record_production()
        wo_form = Form(production.workorder_ids, view='mrp_workorder.mrp_workorder_view_form_tablet')
        wo_form.final_lot_id = self.sp2
        self.assertEqual(wo_form.lot_id, self.elon2, "component lot should be prefilled")
        self.assertEqual(wo_form.qty_done, 1, "component quantity should be 1 as final product is tracked")
        self.assertEqual(wo_form.qty_producing, 1, "Quantity to produce should prefilled with 1 (serial tracked product)")
        wo = wo_form.save()
        self.assertEqual(wo.qty_production, 2, "Quantity to produce should be 2")
        wo._next()
        wo_form = Form(production.workorder_ids, view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.lot_id, self.mc1, "workorder should consume the second product")
        self.assertEqual(wo_form.qty_done, 2, "Quantity to consume should prefilled with 2")
        self.assertEqual(wo_form.component_id, self.metal_cylinder, "workorder should be consume the second product")
        wo = wo_form.save()
        wo._next()
        wo.do_finish()
        production.button_mark_done()

        move_elon = production.move_raw_ids.filtered(lambda move: move.product_id == self.elon_musk)
        self.assertEqual(move_elon.state, 'done', 'Move should be done')
        self.assertEqual(move_elon.quantity_done, 2, 'Consumed quantity should be 2')
        self.assertEqual(len(move_elon.move_line_ids), 2, 'their should be 2 move lines')
        self.assertEqual(move_elon.move_line_ids.mapped('lot_id'), self.elon1 | self.elon2, 'Wrong serial numbers used')
        move_cylinder = production.move_raw_ids.filtered(lambda move: move.product_id == self.metal_cylinder)
        self.assertEqual(move_cylinder.state, 'done', 'Move should be done')
        self.assertEqual(move_cylinder.quantity_done, 4, 'Consumed quantity should be 4')
        move_child = production.move_raw_ids.filtered(lambda move: move.product_id == self.trapped_child)
        self.assertEqual(move_child.state, 'done', 'Move should be done')
        self.assertEqual(move_child.quantity_done, 24, 'Consumed quantity should be 24')

    def test_workorder_reservation_3(self):
        """ Test quantities suggestions """
        # make the whole production in only 1 workorder
        single_routing = self.env['mrp.routing'].create({'name': 'Single'})
        operation_single = self.env['mrp.routing.workcenter'].create({
            'routing_id': single_routing.id,
            'workcenter_id': self.workcenter_1.id,
            'name': 'Manual Assembly',
            'time_cycle': 60,
            'sequence': 5,
        })
        self.bom_submarine.routing_id = single_routing
        self.bom_submarine.bom_line_ids.write({'operation_id': operation_single.id})
        self.bom_submarine.bom_line_ids.filtered(lambda line: line.product_id == self.elon_musk).product_qty = 2
        self.bom_submarine.bom_line_ids.filtered(lambda line: line.product_id == self.metal_cylinder).product_qty = 3
        self.bom_submarine.bom_line_ids.filtered(lambda line: line.product_id == self.trapped_child).unlink()
        self.mc2 = self.env['stock.production.lot'].create({
            'product_id': self.metal_cylinder.id,
            'name': 'mc2'})
        self.env['stock.quant']._update_available_quantity(self.metal_cylinder, self.location_1, -5.0, lot_id=self.mc1)
        self.env['stock.quant']._update_available_quantity(self.metal_cylinder, self.location_1, 2.0, lot_id=self.mc2)

        mrp_order_form = Form(self.env['mrp.production'])
        self.submarine_pod.tracking = 'none'
        mrp_order_form.product_id = self.submarine_pod
        mrp_order_form.product_qty = 1
        production = mrp_order_form.save()

        production.action_confirm()
        production.action_assign()
        production.button_plan()
        self.assertEqual(len(production.workorder_ids), 1, "wrong number of workorders")
        self.assertEqual(production.workorder_ids[0].state, 'ready', "workorder state should be 'ready'")

        wo_form = Form(production.workorder_ids[0], view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.qty_producing, 1, "Wrong quantity to produce")
        self.assertEqual(wo_form.component_id, self.elon_musk, "The component should be changed")
        self.assertEqual(wo_form.lot_id, self.elon1, "The component should be changed")
        self.assertEqual(wo_form.qty_done, 1, "Wrong suggested quantity")
        wo = wo_form.save()
        wo.action_continue()
        wo_form = Form(production.workorder_ids[0], view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.lot_id, self.elon2, "The component should be changed")
        self.assertEqual(wo_form.qty_done, 1, "Wrong suggested quantity")
        wo = wo_form.save()
        wo._next()
        wo_form = Form(production.workorder_ids[0], view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.component_id, self.metal_cylinder, "The component should be changed")
        self.assertEqual(wo_form.lot_id, self.mc1, "wrong suggested lot")
        self.assertEqual(wo_form.qty_done, 1, "wrong suggested quantity")
        wo = wo_form.save()
        wo.action_continue()
        wo_form = Form(production.workorder_ids[0], view='mrp_workorder.mrp_workorder_view_form_tablet')
        self.assertEqual(wo_form.lot_id, self.mc2, "Wrong suggested lot")
        self.assertEqual(wo_form.qty_done, 2, "Wrong suggested quantity")
        wo = wo_form.save()
        wo._next()
        wo.do_finish()
        production.button_mark_done()

        move_elon = production.move_raw_ids.filtered(lambda move: move.product_id == self.elon_musk)
        self.assertEqual(move_elon.state, 'done', 'Move should be done')
        self.assertEqual(move_elon.quantity_done, 2, 'Consumed quantity should be 2')
        self.assertEqual(len(move_elon.move_line_ids), 2, 'their should be 2 move lines')
        self.assertEqual(move_elon.move_line_ids.mapped('lot_id'), self.elon1 | self.elon2, 'Wrong serial numbers used')
        move_cylinder = production.move_raw_ids.filtered(lambda move: move.product_id == self.metal_cylinder)
        self.assertEqual(move_cylinder.state, 'done', 'Move should be done')
        self.assertEqual(move_cylinder.quantity_done, 3, 'Consumed quantity should be 4')
        self.assertEqual(move_cylinder.move_line_ids.mapped('lot_id'), self.mc1 | self.mc2, 'Wrong serial numbers used')
