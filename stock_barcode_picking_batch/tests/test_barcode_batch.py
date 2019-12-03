# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from unittest.mock import patch

import odoo
from odoo.tests import HttpCase, tagged
from odoo.tests.common import Form
from odoo.addons.stock_barcode.tests.test_barcode_client_action import clean_access_rights, TestBarcodeClientAction


@tagged('post_install', '-at_install')
class TestBarcodeBatchClientAction(TestBarcodeClientAction):
    def setUp(self):
        super().setUp()

        clean_access_rights(self.env)
        grp_lot = self.env.ref('stock.group_production_lot')
        grp_multi_loc = self.env.ref('stock.group_stock_multi_locations')
        self.env.user.write({'groups_id': [(4, grp_multi_loc.id, 0)]})
        self.env.user.write({'groups_id': [(4, grp_lot.id, 0)]})

        # Create some products
        self.product3 = self.env['product.product'].create({
            'name': 'product3',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
            'barcode': 'product3',
        })
        self.product4 = self.env['product.product'].create({
            'name': 'product4',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
            'barcode': 'product4',
        })

        # Create some quants (for deliveries)
        Quant = self.env['stock.quant']
        Quant.with_context(inventory_mode=True).create({
            'product_id': self.product1.id,
            'location_id': self.shelf1.id,
            'inventory_quantity': 2
        })
        Quant.with_context(inventory_mode=True).create({
            'product_id': self.product2.id,
            'location_id': self.shelf2.id,
            'inventory_quantity': 1
        })
        Quant.with_context(inventory_mode=True).create({
            'product_id': self.product2.id,
            'location_id': self.shelf3.id,
            'inventory_quantity': 1
        })
        Quant.with_context(inventory_mode=True).create({
            'product_id': self.product3.id,
            'location_id': self.shelf3.id,
            'inventory_quantity': 2
        })
        Quant.with_context(inventory_mode=True).create({
            'product_id': self.product4.id,
            'location_id': self.shelf1.id,
            'inventory_quantity': 1
        })
        Quant.with_context(inventory_mode=True).create({
            'product_id': self.product4.id,
            'location_id': self.shelf4.id,
            'inventory_quantity': 1
        })

        # Create a first receipt for 2 products.
        picking_form = Form(self.env['stock.picking'])
        picking_form.picking_type_id = self.picking_type_in
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = self.product1
            move.product_uom_qty = 1
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = self.productserial1
            move.product_uom_qty = 2
        self.picking_receipt_1 = picking_form.save()
        self.picking_receipt_1.action_confirm()

        # Create a second receipt for 2 products.
        picking_form = Form(self.env['stock.picking'])
        picking_form.picking_type_id = self.picking_type_in
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = self.product1
            move.product_uom_qty = 3
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = self.productlot1
            move.product_uom_qty = 8
        self.picking_receipt_2 = picking_form.save()
        self.picking_receipt_2.action_confirm()

        # Changes name of pickings to be able to track them on the tour
        self.picking_receipt_1.name = 'picking_receipt_1'
        self.picking_receipt_2.name = 'picking_receipt_2'

        # Create a first delivery for 2 products.
        picking_form = Form(self.env['stock.picking'])
        picking_form.picking_type_id = self.picking_type_out
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = self.product1
            move.product_uom_qty = 1
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = self.product2
            move.product_uom_qty = 2
        self.picking_delivery_1 = picking_form.save()
        self.picking_delivery_1.action_confirm()
        self.picking_delivery_1.action_assign()

        # Create a second delivery for 3 products.
        picking_form = Form(self.env['stock.picking'])
        picking_form.picking_type_id = self.picking_type_out
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = self.product1
            move.product_uom_qty = 1
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = self.product3
            move.product_uom_qty = 2
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = self.product4
            move.product_uom_qty = 2
        self.picking_delivery_2 = picking_form.save()
        self.picking_delivery_2.action_confirm()
        self.picking_delivery_2.action_assign()

        # Changes name of pickings to be able to track them on the tour
        self.picking_delivery_1.name = 'picking_delivery_1'
        self.picking_delivery_2.name = 'picking_delivery_2'

    def _get_batch_client_action_url(self, batch_id):
        return '/web#model=stock.picking.batch&picking_batch_id=%s&action=stock_barcode_picking_batch_client_action' % batch_id

    def test_batch_receipt(self):
        """ Create a batch picking with 2 receipts, then open the batch in
        barcode app and scan each product, SN or LN one by one.
        """

        batch_form = Form(self.env['stock.picking.batch'])
        batch_form.picking_ids.add(self.picking_receipt_1)
        batch_form.picking_ids.add(self.picking_receipt_2)
        batch_receipt = batch_form.save()
        self.assertEqual(
            batch_receipt.picking_type_id.id,
            self.picking_receipt_1.picking_type_id.id,
            "Batch picking must take the picking type of its sub-pickings"
        )
        batch_receipt.action_confirm()
        self.assertEqual(len(batch_receipt.move_ids), 4)
        self.assertEqual(len(batch_receipt.move_line_ids), 5)

        batch_write = odoo.addons.stock_picking_batch.models.stock_picking_batch.StockPickingBatch.write
        url = self._get_batch_client_action_url(batch_receipt.id)
        self.start_tour(url, 'test_barcode_batch_receipt_1', login='admin', timeout=180)

    def test_batch_delivery(self):
        """ Create a batch picking with 2 delivries (split into 3 locations),
        then open the batch in barcode app and scan each product.
        Change the location when all products of the page has been scanned.
        """
        batch_form = Form(self.env['stock.picking.batch'])
        batch_form.picking_ids.add(self.picking_delivery_1)
        batch_form.picking_ids.add(self.picking_delivery_2)
        batch_delivery = batch_form.save()
        self.assertEqual(
            batch_delivery.picking_type_id.id,
            self.picking_delivery_1.picking_type_id.id,
            "Batch picking must take the picking type of its sub-pickings"
        )
        batch_delivery.action_confirm()
        self.assertEqual(len(batch_delivery.move_ids), 5)
        self.assertEqual(len(batch_delivery.move_line_ids), 7)

        url = self._get_batch_client_action_url(batch_delivery.id)
        self.start_tour(url, 'test_barcode_batch_delivery_1', login='admin', timeout=180)
