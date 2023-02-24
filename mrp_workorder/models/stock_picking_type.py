# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields

class PickingType(models.Model):
    _inherit = 'stock.picking.type'

    prefill_lot_tablet = fields.Boolean(
        'Pre-fill Lot/Serial Numbers in Tablet View', default=True,
        help="If this checkbox is ticked, the serial numbers lines for this operation type will be pre-filled in the manufacturing tablet view.")
