#  -*- coding: utf-8 -*-
#  Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class StockMoveLine(models.Model):
    _inherit = 'stock.move.line'

    is_subcontract_stock_barcode = fields.Boolean(compute="_compute_is_subcontract_stock_barcode")

    @api.depends('move_id.is_subcontract')
    def _compute_is_subcontract_stock_barcode(self):
        for line in self:
            line.is_subcontract_stock_barcode = line.move_id.is_subcontract and line.move_id._has_tracked_subcontract_components()

    def _get_fields_stock_barcode(self):
        """ Inject info if the line is subcontract and have tracked component """
        return super()._get_fields_stock_barcode() + ['move_id', 'is_subcontract_stock_barcode']
