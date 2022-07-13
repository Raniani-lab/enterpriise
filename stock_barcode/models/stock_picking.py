# -*- coding: utf-8 -*-

from odoo import models, api, _
from odoo.tools import html2plaintext, is_html_empty


class StockPicking(models.Model):
    _inherit = 'stock.picking'
    _barcode_field = 'name'

    def action_cancel_from_barcode(self):
        self.ensure_one()
        view = self.env.ref('stock_barcode.stock_barcode_cancel_operation_view')
        return {
            'name': _('Cancel this operation ?'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'stock_barcode.cancel.operation',
            'views': [(view.id, 'form')],
            'view_id': view.id,
            'target': 'new',
            'context': dict(self.env.context, default_picking_id=self.id),
        }

    @api.model
    def action_open_new_picking(self):
        """ Creates a new picking of the current picking type and open it.

        :return: the action used to open the picking, or false
        :rtype: dict
        """
        context = self.env.context
        if context.get('active_model') == 'stock.picking.type':
            picking_type = self.env['stock.picking.type'].browse(context.get('active_id'))
            if picking_type.exists():
                new_picking = self._create_new_picking(picking_type)
                return new_picking._get_client_action()['action']
        return False

    def action_open_picking(self):
        """ method to open the form view of the current record
        from a button on the kanban view
        """
        self.ensure_one()
        view_id = self.env.ref('stock.view_picking_form').id
        return {
            'name': _('Open picking form'),
            'res_model': 'stock.picking',
            'view_mode': 'form',
            'view_id': view_id,
            'type': 'ir.actions.act_window',
            'res_id': self.id,
        }

    def action_open_picking_client_action(self):
        """ method to open the form view of the current record
        from a button on the kanban view
        """
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("stock_barcode.stock_barcode_picking_client_action")
        action = dict(action, target='fullscreen')
        action['context'] = {'active_id': self.id}
        return action

    def action_print_barcode_pdf(self):
        return self.action_open_label_type()

    def action_print_delivery_slip(self):
        return self.env.ref('stock.action_report_delivery').report_action(self)

    def action_print_packges(self):
        return self.env.ref('stock.action_report_picking_packages').report_action(self)

    def _get_stock_barcode_data(self):
        # Avoid to get the products full name because code and name are separate in the barcode app.
        self = self.with_context(display_default_code=False)
        move_lines = self.move_line_ids
        lots = move_lines.lot_id
        owners = move_lines.owner_id
        # Fetch all implied products in `self` and adds last used products to avoid additional rpc.
        products = move_lines.product_id
        packagings = products.packaging_ids

        uoms = products.uom_id | move_lines.product_uom_id
        # If UoM setting is active, fetch all UoM's data.
        if self.env.user.has_group('uom.group_uom'):
            uoms |= self.env['uom.uom'].search([])

        # Fetch `stock.quant.package` and `stock.package.type` if group_tracking_lot.
        packages = self.env['stock.quant.package']
        package_types = self.env['stock.package.type']
        if self.env.user.has_group('stock.group_tracking_lot'):
            packages |= move_lines.package_id | move_lines.result_package_id
            packages |= self.env['stock.quant.package']._get_usable_packages()
            package_types = package_types.search([])

        # Fetch `stock.location`
        source_locations = self.env['stock.location'].search([('id', 'child_of', self.location_id.ids)])
        destination_locations = self.env['stock.location'].search([('id', 'child_of', self.location_dest_id.ids)])
        locations = move_lines.location_id | move_lines.location_dest_id | source_locations | destination_locations
        data = {
            "records": {
                "stock.picking": self.read(self._get_fields_stock_barcode(), load=False),
                "stock.move.line": move_lines.read(move_lines._get_fields_stock_barcode(), load=False),
                "product.product": products.with_context(partner_id=self.partner_id.id).read(products._get_fields_stock_barcode(), load=False),
                "product.packaging": packagings.read(packagings._get_fields_stock_barcode(), load=False),
                "res.partner": owners.read(owners._get_fields_stock_barcode(), load=False),
                "stock.location": locations.read(locations._get_fields_stock_barcode(), load=False),
                "stock.package.type": package_types.read(package_types._get_fields_stock_barcode(), False),
                "stock.quant.package": packages.read(packages._get_fields_stock_barcode(), load=False),
                "stock.lot": lots.read(lots._get_fields_stock_barcode(), load=False),
                "uom.uom": uoms.read(uoms._get_fields_stock_barcode(), load=False),
            },
            "nomenclature_id": [self.env.company.nomenclature_id.id],
            "source_location_ids": source_locations.ids,
            "destination_locations_ids": destination_locations.ids,
        }
        # Extracts pickings' note if it's empty HTML.
        for picking in data['records']['stock.picking']:
            picking['note'] = False if is_html_empty(picking['note']) else html2plaintext(picking['note'])
        return data

    @api.model
    def _create_new_picking(self, picking_type):
        """ Create a new picking for the given picking type.

        :param picking_type:
        :type picking_type: :class:`~odoo.addons.stock.models.stock_picking.PickingType`
        :return: a new picking
        :rtype: :class:`~odoo.addons.stock.models.stock_picking.Picking`
        """
        # Find source and destination Locations
        location_dest_id, location_id = picking_type.warehouse_id._get_partner_locations()
        if picking_type.default_location_src_id:
            location_id = picking_type.default_location_src_id
        if picking_type.default_location_dest_id:
            location_dest_id = picking_type.default_location_dest_id

        # Create and confirm the picking
        return self.env['stock.picking'].create({
            'user_id': False,
            'picking_type_id': picking_type.id,
            'location_id': location_id.id,
            'location_dest_id': location_dest_id.id,
            'immediate_transfer': True,
        })

    def _get_client_action(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("stock_barcode.stock_barcode_picking_client_action")
        action = dict(action, target='fullscreen')
        action['context'] = {'active_id': self.id}
        return {'action': action}

    def _get_fields_stock_barcode(self):
        """ List of fields on the stock.picking object that are needed by the
        client action. The purpose of this function is to be overridden in order
        to inject new fields to the client action.
        """
        return [
            'move_line_ids',
            'picking_type_id',
            'location_id',
            'location_dest_id',
            'name',
            'state',
            'picking_type_code',
            'company_id',
            'immediate_transfer',
            'note',
            'picking_type_entire_packs',
            'use_create_lots',
            'use_existing_lots',
        ]

    @api.model
    def filter_on_barcode(self, barcode):
        """ Searches ready pickings for the scanned product/package.
        """
        barcode_type = None
        nomenclature = self.env.company.nomenclature_id
        if nomenclature.is_gs1_nomenclature:
            parsed_results = nomenclature.parse_barcode(barcode)
            if parsed_results:
                # filter with the last feasible rule
                for result in parsed_results[::-1]:
                    if result['rule'].type in ('product', 'package'):
                        barcode_type = result['rule'].type
                        break

        picking_type = self.env['stock.picking.type'].browse(self.env.context.get('active_id'))
        base_domain = [
            ('picking_type_id', '=', picking_type.id),
            ('state', 'not in', ['cancel', 'done', 'draft'])
        ]

        picking_nums = 0
        additional_context = {}
        if barcode_type == 'product' or not barcode_type:
            product = self.env['product.product'].search_read([('barcode', '=', barcode)], ['id'], limit=1)
            if product:
                product_id = product[0]['id']
                picking_nums = self.search_count(base_domain + [('product_id', '=', product_id)])
                additional_context = {'search_default_product_id': product_id}
        if self.env.user.has_group('stock.group_tracking_lot') and (barcode_type == 'package' or (not barcode_type and not picking_nums)):
            package = self.env['stock.quant.package'].search_read([('name', '=', barcode)], ['id'], limit=1)
            if package:
                package_id = package[0]['id']
                pack_domain = ['|', ('move_line_ids.package_id', '=', package_id), ('move_line_ids.result_package_id', '=', package_id)]
                picking_nums = self.search_count(base_domain + pack_domain)
                additional_context = {'search_default_move_line_ids': barcode}

        if not picking_nums:
            if barcode_type:
                return {
                    'warning': {
                        'title': _("No %(picking_type)s ready for this %(barcode_type)s", picking_type=picking_type.name, barcode_type=barcode_type),
                    }
                }
            return {
                'warning': {
                    'title': _('No product or package found for barcode %s', barcode),
                    'message': _('Scan a product or a package to filter the transfers.'),
                }
            }

        action = self.env['ir.actions.actions']._for_xml_id('stock_barcode.stock_picking_action_kanban')
        action['context'] = dict(self.env.context)
        action['context'].update(additional_context)
        return {'action': action}


class StockPickingType(models.Model):

    _inherit = 'stock.picking.type'

    def get_action_picking_tree_ready_kanban(self):
        return self._get_action('stock_barcode.stock_picking_action_kanban')
