# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.mrp.tests import common
from odoo.tests import Form
from odoo.exceptions import UserError

from unittest import skip

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

    @skip('waiting forward port')
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

    @skip('waiting forward port')
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

    @skip('waiting forward port')
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

    @skip('waiting forward port')
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
