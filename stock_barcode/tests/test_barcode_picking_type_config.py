# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import Form, tagged
from odoo.addons.stock_barcode.tests.test_barcode_client_action import clean_access_rights, TestBarcodeClientAction


@tagged('post_install', '-at_install')
class TestPickingTypeConfigBarcodeClientAction(TestBarcodeClientAction):
    def test_picking_type_mandatory_scan_settings(self):
        ''' Makes some operations with different scan's settings.'''
        clean_access_rights(self.env)

        # Enables packages and multi-locations.
        grp_multi_loc = self.env.ref('stock.group_stock_multi_locations')
        grp_lot = self.env.ref('stock.group_production_lot')
        self.env.user.write({'groups_id': [(4, grp_multi_loc.id, 0), (4, grp_lot.id, 0)]})
        # Creates a product without barcode to check it can always be processed regardless the config.
        product_without_barcode = self.env['product.product'].create({
            'name': 'Barcodeless Product',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        # Adds products' quantities.
        self.env['stock.quant']._update_available_quantity(self.product1, self.shelf1, 8)
        self.env['stock.quant']._update_available_quantity(product_without_barcode, self.shelf1, 8)

        # First config: products must be scanned, empty picking can't be immediatly validated,
        # locations can't be scanned, no put in pack.
        self.picking_type_internal.barcode_validation_after_dest_location = False
        self.picking_type_internal.barcode_validation_all_product_packed = False
        self.picking_type_internal.barcode_validation_full = False
        self.picking_type_internal.restrict_scan_product = True
        self.picking_type_internal.restrict_put_in_pack = 'optional'
        self.picking_type_internal.restrict_scan_source_location = 'no'
        self.picking_type_internal.restrict_scan_dest_location = 'no'

        # Creates an internal transfer, from WH/Stock/Shelf 1 to WH/Stock.
        picking_form = Form(self.env['stock.picking'])
        picking_form.picking_type_id = self.picking_type_internal
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = self.product1
            move.product_uom_qty = 4
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = product_without_barcode
            move.product_uom_qty = 4

        picking_internal_1 = picking_form.save()
        picking_internal_1.action_confirm()
        picking_internal_1.action_assign()

        url = self._get_client_action_url(picking_internal_1.id)
        self.start_tour(url, 'test_picking_type_mandatory_scan_settings_pick_int_1', login='admin', timeout=180)
        self.assertEqual(picking_internal_1.state, 'done')

        # Second picking: change the config (same than before but locations MUST be scanned).
        self.picking_type_internal.restrict_scan_source_location = 'mandatory'
        self.picking_type_internal.restrict_scan_dest_location = 'mandatory'
        # Creates an internal transfer, from WH/Stock/Shelf 1 to WH/Stock.
        picking_form = Form(self.env['stock.picking'])
        picking_form.picking_type_id = self.picking_type_internal
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = self.product1
            move.product_uom_qty = 4
        with picking_form.move_ids_without_package.new() as move:
            move.product_id = product_without_barcode
            move.product_uom_qty = 4

        picking_internal_2 = picking_form.save()
        picking_internal_2.action_confirm()
        picking_internal_2.action_assign()

        url = self._get_client_action_url(picking_internal_2.id)
        self.start_tour(url, 'test_picking_type_mandatory_scan_settings_pick_int_2', login='admin', timeout=180)
        self.assertEqual(picking_internal_2.state, 'done')

    def test_picking_type_mandatory_scan_complete_flux(self):
        """ From the receipt to the delivery, make a complete flux with each
        picking types having their own barcode's settings:
        - Starts by receive multiple products (some of them are tracked);
        - Stores each product in a different location;
        - Makes a picking operation;
        - Then makes a packing operation and put all products in pack;
        - And finally, does the delivery.
        """
        def create_picking(picking_type):
            picking_form = Form(self.env['stock.picking'])
            picking_form.picking_type_id = picking_type
            with picking_form.move_ids_without_package.new() as move:
                move.product_id = self.product1
                move.product_uom_qty = 2
            with picking_form.move_ids_without_package.new() as move:
                move.product_id = self.product2
                move.product_uom_qty = 1
            with picking_form.move_ids_without_package.new() as move:
                move.product_id = product_without_barcode
                move.product_uom_qty = 1
            with picking_form.move_ids_without_package.new() as move:
                move.product_id = self.productserial1
                move.product_uom_qty = 3
            with picking_form.move_ids_without_package.new() as move:
                move.product_id = self.productlot1
                move.product_uom_qty = 6
            return picking_form.save()

        clean_access_rights(self.env)
        # Creates a product without barcode to check it can always be processed regardless the config.
        product_without_barcode = self.env['product.product'].create({
            'name': 'Barcodeless Product',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })

        # Enables packages, multi-locations and multiple steps routes.
        self.env.user.write({'groups_id': [(4, self.env.ref('stock.group_production_lot').id, 0)]})
        self.env.user.write({'groups_id': [(4, self.env.ref('stock.group_tracking_lot').id, 0)]})
        self.env.user.write({'groups_id': [(4, self.env.ref('stock.group_stock_multi_locations').id, 0)]})
        self.env.user.write({'groups_id': [(4, self.env.ref('stock.group_adv_location').id, 0)]})
        warehouse = self.env.ref('stock.warehouse0')
        warehouse.reception_steps = 'two_steps'
        warehouse.delivery_steps = 'pick_pack_ship'

        # Configures the picking type's scan settings.
        # Receipt: no put in pack, can not be directly validate.
        self.picking_type_in.barcode_validation_full = False
        self.picking_type_in.restrict_put_in_pack = 'no'
        # Storage (internal transfer): no put in pack, scan dest. after each product.
        self.picking_type_internal.barcode_validation_full = False
        self.picking_type_internal.restrict_put_in_pack = 'no'
        self.picking_type_internal.restrict_scan_dest_location = 'mandatory'
        # Pick: source mandatory, lots reserved only.
        warehouse.pick_type_id.barcode_validation_full = False
        warehouse.pick_type_id.restrict_scan_source_location = 'mandatory'
        warehouse.pick_type_id.restrict_put_in_pack = 'no'
        warehouse.pick_type_id.restrict_scan_tracking_number = 'mandatory'
        warehouse.pick_type_id.restrict_scan_dest_location = 'no'
        # Pack: pack after group, all products have to be packed to be validate.
        warehouse.pack_type_id.restrict_put_in_pack = 'optional'
        warehouse.pack_type_id.restrict_scan_tracking_number = 'mandatory'
        warehouse.pack_type_id.barcode_validation_all_product_packed = True
        # Delivery: pack after group, all products have to be packed to be validate.
        self.picking_type_out.restrict_put_in_pack = 'optional'
        self.picking_type_out.restrict_scan_tracking_number = 'mandatory'
        self.picking_type_out.barcode_validation_all_product_packed = True

        # Creates and assigns the receipt.
        picking_receipt = create_picking(self.picking_type_in)
        picking_receipt.action_confirm()
        picking_receipt.action_assign()
        # Get the storage operation (automatically created by the receipt).
        picking_internal = picking_receipt.move_ids.move_dest_ids.picking_id

        # Creates the pick, pack, ship.
        picking_pick = create_picking(warehouse.pick_type_id)
        # picking_pack = create_picking(warehouse.pack_type_id)
        # picking_delivery = create_picking(self.picking_type_out)

        # Process each picking one by one.
        url = self._get_client_action_url(picking_receipt.id)
        self.start_tour(url, 'test_picking_type_mandatory_scan_complete_flux_receipt', login='admin', timeout=180)
        self.assertEqual(picking_receipt.state, 'done')

        url = self._get_client_action_url(picking_internal.id)
        self.start_tour(url, 'test_picking_type_mandatory_scan_complete_flux_internal', login='admin', timeout=180)
        self.assertEqual(picking_internal.state, 'done')

        picking_pick.action_confirm()
        picking_pick.action_assign()
        url = self._get_client_action_url(picking_pick.id)
        self.start_tour(url, 'test_picking_type_mandatory_scan_complete_flux_pick', login='admin', timeout=180)
        self.assertEqual(picking_pick.state, 'done')

        # TODO
        # picking_pack.action_confirm()
        # picking_pack.action_assign()
        # url = self._get_client_action_url(picking_pack.id)
        # self.start_tour(url, 'test_picking_type_mandatory_scan_complete_flux_pack', login='admin', timeout=180)
        # self.assertEqual(picking_pack.state, 'done')

        # TODO
        # picking_delivery.action_confirm()
        # picking_delivery.action_assign()
        # url = self._get_client_action_url(picking_delivery.id)
        # self.start_tour(url, 'test_picking_type_mandatory_scan_complete_flux_delivery', login='admin', timeout=180)
        # self.assertEqual(picking_delivery.state, 'done')
