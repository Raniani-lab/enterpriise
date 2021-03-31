# -*- coding: utf-8 -*-

from odoo import models, fields, api


class StockQuant(models.Model):
    _inherit = 'stock.quant'

    dummy_id = fields.Char(compute='_compute_dummy_id', inverse='_inverse_dummy_id')

    def _compute_dummy_id(self):
        self.dummy_id = ''

    def _inverse_dummy_id(self):
        pass

    def action_client_action(self):
        """ Open the mobile view specialized in handling barcodes on mobile devices.
        """
        # self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'stock_barcode_inventory_client_action',
            'target': 'fullscreen',
            'params': {
                'model': 'stock.quant',
            }
        }

    def get_barcode_view_state(self):
        """ Return the initial state of the barcode view as a dict.
        """

        inventory = {}

        # FIXME: improve handling of abstract_client_action values no longer applicable for inventory
        inventory['id'] = False
        inventory['name'] = ''

        location_ids = self.env['stock.location']
        company_id = self.env.context.get('company_id') or self.env.company.id
        if self.env.user.has_group('stock.group_stock_multi_locations'):
            # now that we can't choose inventory adjustment locations, assume we can do all locations
            location_ids = self.env['stock.location'].search([('usage', 'in', ['internal', 'transit']), ('company_id', '=', company_id)], order='id')
        else:
            location_ids = self.env['stock.warehouse'].search([('company_id', '=', company_id)], limit=1).lot_stock_id

        quants = self.env['stock.quant'].search([('user_id', '=', self.env.user.id), ('location_id', 'in', location_ids.ids), ('inventory_date', '<=', fields.Date.today())])

        inventory['line_ids'] = quants.read([
            'product_id',
            'location_id',
            'inventory_quantity',
            'quantity',
            'product_uom_id',
            'lot_id',
            'package_id',
            'owner_id',
            'inventory_diff_quantity',
            'dummy_id',
        ])

        inventory['location_ids'] = location_ids.read([
            'id',
            'display_name',
            'parent_path',
        ])

        # Prefetch data
        product_ids = list(set([line_id["product_id"][0] for line_id in inventory['line_ids']]))

        parent_path_per_location_id = {}
        for location_id in location_ids:
            parent_path_per_location_id[location_id.id] = {'parent_path': location_id.parent_path}
        tracking_and_barcode_per_product_id = self.env['product.product'].browse(product_ids)._get_fields_per_product_id()

        for line_id in inventory['line_ids']:
            product_id, name = line_id.pop('product_id')
            line_id['product_id'] = {"id": product_id, "display_name": name, **tracking_and_barcode_per_product_id[product_id]}
            location_id, name = line_id.pop('location_id')
            line_id['location_id'] = {"id": location_id, "display_name": name, **parent_path_per_location_id[location_id]}
        inventory['group_stock_multi_locations'] = self.env.user.has_group('stock.group_stock_multi_locations')
        inventory['group_tracking_owner'] = self.env.user.has_group('stock.group_tracking_owner')
        inventory['group_tracking_lot'] = self.env.user.has_group('stock.group_tracking_lot')
        inventory['group_production_lot'] = self.env.user.has_group('stock.group_production_lot')
        inventory['group_uom'] = self.env.user.has_group('uom.group_uom')
        inventory['company_id'] = (self.env.company.id, self.env.company.name)
        inventory['actionReportInventory'] = self.env.ref('stock.action_report_inventory').id
        if self.env.company.nomenclature_id:
            inventory['nomenclature_id'] = [self.env.company.nomenclature_id.id]
        return [inventory]

    @api.model
    def barcode_write(self, vals):
        """ Specially made to handle barcode app saving. Avoids overriding write method because pickings in barcode
        will also write to quants and handling context in this case is non-trivial. This method is expected to be
        called only when no record and vals is a list of lists of the form: [[1, quant_id, {write_values}],
        [0, 0, {write_values}], ...]} where [1, quant_id...] updates an existing quant or {[0, 0, ...]}
        when creating a new quant."""
        Quant = self.env['stock.quant'].with_context(inventory_mode=True)
        for val in vals:
            if val[0] == 1:
                Quant.browse(val[1]).write(val[2])
            elif val[0] == 0:
                quant = Quant.create(val[2])
                # in case an existing quant is written on instead (happens when scanning a product
                # with quants, but not assigned to user or doesn't have an inventory date to normally show up in view)
                if val[2].get('dummy_id'):
                    quant.write({'dummy_id': val[2].get('dummy_id')})
                quant.write({'inventory_date': val[2].get('inventory_date')})
                user_id = val[2].get('user_id')
                # assign a user if one isn't assigned to avoid line disappearing when page left and returned to
                if not quant.user_id and user_id:
                    quant.write({'user_id': user_id})


    @api.model
    def action_validate(self, line_ids):
        ids = [line['id'] for line in line_ids[0]]
        quants = self.env['stock.quant'].with_context(inventory_mode=True).search([('id', 'in', ids)])
        quants._compute_inventory_diff_quantity()
        quants.action_apply_inventory()
        return True

    def _get_inventory_fields_write(self):
        return ['dummy_id'] + super()._get_inventory_fields_write()
