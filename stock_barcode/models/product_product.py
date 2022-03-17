# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
from odoo import models, api
from odoo.exceptions import ValidationError


class Product(models.Model):
    _inherit = 'product.product'
    _barcode_field = 'barcode'

    @api.model
    def _search(self, args, offset=0, limit=None, order=None, count=False, access_rights_uid=None):
        # Override to cut off the padding if using GS1 and searching on barcode
        # if the barcode is only digits to keep the original barcode part only.
        for i, arg in enumerate(args):
            if not isinstance(arg, (list, tuple)) or len(arg) != 3:
                continue
            field_name, operator, value = arg
            if field_name != 'barcode' or operator not in ['ilike', 'not ilike', '=', '!=']:
                continue
            nomenclature = self.env.company.nomenclature_id
            if not nomenclature.is_gs1_nomenclature:
                break

            parsed_data = []
            try:
                parsed_data += nomenclature.parse_barcode(value) or []
            except (ValidationError, ValueError):
                pass

            replacing_operator = 'ilike' if operator in ['ilike', '='] else 'not ilike'
            # If it's a valid GS1 barcode, checks if a product data was found.
            for data in parsed_data:
                if data['rule'].type != 'product':
                    continue
                value = data['value']
                match = re.match('0*([0-9]+)$', value)
                if match:
                    unpadded_barcode = match.groups()[0]
                    if unpadded_barcode != value:
                        args[i] = (field_name, replacing_operator, unpadded_barcode)
                break
            # The barcode isn't a valid GS1 barcode, checks if it can be unpadded.
            if not parsed_data:
                match = re.match('0+([0-9]+)$', value)
                if match:
                    args[i] = (field_name, replacing_operator, match.groups()[0])
            break
        return super()._search(args, offset=offset, limit=limit, order=order, count=count, access_rights_uid=access_rights_uid)

    @api.model
    def _get_fields_stock_barcode(self):
        return ['barcode', 'default_code', 'code', 'detailed_type', 'tracking', 'display_name', 'uom_id']

    def _get_stock_barcode_specific_data(self):
        return {
            'uom.uom': self.uom_id.read(self.env['uom.uom']._get_fields_stock_barcode(), load=False)
        }

    def prefilled_owner_package_stock_barcode(self, lot_id=False, lot_name=False):
        quant = self.env['stock.quant'].search_read(
            [
                lot_id and ('lot_id', '=', lot_id) or lot_name and ('lot_id.name', '=', lot_name),
                ('location_id.usage', '=', 'internal'),
                ('product_id', '=', self.id),
            ],
            ['package_id', 'owner_id'],
            limit=1, load=False
        )
        if quant:
            quant = quant[0]
        res = {'quant': quant, 'records': {}}
        if quant and quant['package_id']:
            res['records']['stock.quant.package'] = self.env['stock.quant.package'].browse(quant['package_id']).read(self.env['stock.quant.package']._get_fields_stock_barcode(), load=False)
        if quant and quant['owner_id']:
            res['records']['res.partner'] = self.env['res.partner'].browse(quant['owner_id']).read(self.env['res.partner']._get_fields_stock_barcode(), load=False)

        return res
