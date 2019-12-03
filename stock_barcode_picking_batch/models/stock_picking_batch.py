# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class StockPickingBatch(models.Model):
    _inherit = 'stock.picking.batch'

    def action_client_action(self):
        """ Open the mobile view specialized in handling barcodes on mobile devices.
        """
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'stock_barcode_picking_batch_client_action',
            'target': 'fullscreen',
            'params': {
                'model': 'stock.picking.batch',
                'picking_batch_id': self.id,
            }
        }

    def action_open_batch_picking(self):
        """ Method to open the form view of the current record from a button on the kanban view.
        """
        self.ensure_one()
        view_id = self.env.ref('stock_picking_batch.stock_picking_batch_form').id
        return {
            'name': _('Open picking batch form'),
            'res_model': 'stock.picking.batch',
            'view_mode': 'form',
            'view_id': view_id,
            'type': 'ir.actions.act_window',
            'res_id': self.id,
        }

    def _define_picking_colors(self):
        """ Defines a color hue for each picking. These values will be used to
        color picking batch lines in barcode app.

        :return: a dict where the picking id is the key and the color is the value.
        :rtype: dict
        """
        count = 0
        colors = {}
        if self.picking_ids:
            # The hue goes from 0 to 360 as it works this way in CSS.
            hue_shift = 360 / len(self.picking_ids)
            for picking in self.picking_ids:
                colors[picking.id] = count * hue_shift
                count += 1
        return colors

    def get_barcode_view_state(self):
        """ Return the initial state of the barcode view as a dict.
        """
        picking_colors = self._define_picking_colors()
        fields_to_read = self._get_fields_to_read()
        batch_pickings = self.read(fields_to_read)
        for batch_picking in batch_pickings:
            pickings = self.env['stock.picking'].browse(batch_picking.pop('picking_ids'))
            batch_picking['picking_ids'] = pickings.get_barcode_view_state()
            if batch_picking['picking_ids']:
                batch_picking['location_id'] = batch_picking['picking_ids'][0]['location_id']
                batch_picking['location_dest_id'] = batch_picking['picking_ids'][0]['location_dest_id']

            # Get the move lines from the pickings...
            batch_picking['move_line_ids'] = []
            for picking in batch_picking['picking_ids']:
                for move_line in picking['move_line_ids']:
                    # Writes manually used picking fields instead of put
                    # directly picking dict to avoid circular reference.
                    move_line['picking_id'] = {
                        'id': picking['id'],
                        'name': picking['name'],
                    }
                    move_line['color_hue'] = picking_colors[picking['id']]
                    batch_picking['move_line_ids'].append(move_line)
            # ...then sort them to be sure they are always in the same order client side.
            batch_picking['move_line_ids'] = sorted(batch_picking['move_line_ids'], key=lambda line: line['picking_id']['id'])

            batch_picking['group_stock_multi_locations'] = self.env.user.has_group('stock.group_stock_multi_locations')
            batch_picking['group_tracking_owner'] = self.env.user.has_group('stock.group_tracking_owner')
            batch_picking['group_tracking_lot'] = self.env.user.has_group('stock.group_tracking_lot')
            batch_picking['group_production_lot'] = self.env.user.has_group('stock.group_production_lot')
            batch_picking['group_uom'] = self.env.user.has_group('uom.group_uom')
            if batch_picking['picking_type_id']:
                batch_picking['use_create_lots'] = self.env['stock.picking.type'].browse(batch_picking['picking_type_id'][0]).use_create_lots
                batch_picking['use_existing_lots'] = self.env['stock.picking.type'].browse(batch_picking['picking_type_id'][0]).use_existing_lots
        return batch_pickings

    @api.model
    def _get_fields_to_read(self):
        return [
            'company_id',
            'move_line_ids',
            'name',
            'picking_ids',
            'picking_type_id',
            'state',
        ]
