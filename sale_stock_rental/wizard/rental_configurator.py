# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class RentalWizard(models.TransientModel):
    _inherit = 'rental.wizard'

    warehouse_id = fields.Many2one('stock.warehouse', string='Warehouse')

    uom_id = fields.Char(related='product_id.uom_id.name')
    name = fields.Char(related='product_id.name')

    # Stock availability
    rentable_qty = fields.Float(
        string="Quantity available in stock for given period",
        compute='_compute_rentable_qty')

    # Serial number management (lots are disabled for Rental Products)
    tracking = fields.Selection(related='product_id.tracking')
    lot_ids = fields.Many2many(
        'stock.production.lot',
        string="Serials to reserve", help="Only available serial numbers are suggested",
        domain="[('id', 'not in', rented_lot_ids), ('id', 'in', rentable_lot_ids)]")
    rentable_lot_ids = fields.Many2many(
        'stock.production.lot',
        string="Serials available in Stock", compute='_compute_rentable_lots')
    rented_lot_ids = fields.Many2many(
        'stock.production.lot',
        string="Serials in rent for given period", compute='_compute_rented_during_period')

    # Rental Availability
    qty_available_during_period = fields.Float(
        string="Quantity available for given period (Stock - In Rent)",
        compute='_compute_rental_availability')
    enough_stock = fields.Boolean(compute="_compute_rental_availability")

    is_product_storable = fields.Boolean(compute="_compute_is_product_storable")

    @api.depends('pickup_date', 'return_date', 'product_id')
    def _compute_rented_during_period(self):
        if self.tracking != 'serial':
            super(RentalWizard, self)._compute_rented_during_period()
        elif not self.product_id or not self.pickup_date or not self.return_date:
            return
        else:
            fro, to = self.product_id._unavailability_period(self.pickup_date, self.return_date)
            rented_qty, rented_lots = self.product_id._get_rented_qty_lots(
                fro, to,
                ignored_soline_id=self.rental_order_line_id and self.rental_order_line_id.id,
                warehouse_id=self.warehouse_id.id,
            )

            self.rented_qty_during_period = rented_qty
            self.rented_lot_ids = rented_lots

    @api.depends('pickup_date', 'return_date', 'product_id')
    def _compute_rentable_qty(self):
        for rent in self:
            if rent.is_product_storable and rent.pickup_date and rent.return_date:
                reservation_begin, reservation_end = rent.product_id._unavailability_period(rent.pickup_date, rent.return_date)
                rent.rentable_qty = rent.product_id.with_context(
                    from_date=max(reservation_begin, fields.Datetime.now()),
                    to_date=reservation_end,
                    warehouse=rent.warehouse_id.id).qty_available
                if reservation_begin > fields.Datetime.now():
                    # Available qty at period t = available stock now + qty in rent now.
                    rent.rentable_qty += rent.product_id.with_context(warehouse_id=rent.warehouse_id.id).qty_in_rent
            else:
                rent.rentable_qty = 0

    @api.depends('product_id')
    def _compute_rentable_lots(self):
        for rent in self:
            if rent.product_id and rent.tracking == 'serial':
                product_lots = self.env['stock.production.lot'].search([('product_id', '=', rent.product_id.id)])
                rent.rentable_lot_ids = product_lots.filtered(lambda lot: lot._get_available_rental_qty(warehouse=rent.warehouse_id) > 0)
            else:
                rent.rentable_lot_ids = self.env['stock.production.lot']

    @api.depends('quantity', 'rentable_qty', 'rented_qty_during_period')
    def _compute_rental_availability(self):
        for rent in self:
            if not rent.product_id or not rent.is_product_storable or not rent.pickup_date or not rent.return_date:
                rent.enough_stock = True
            else:
                rent.qty_available_during_period = max(rent.rentable_qty - rent.rented_qty_during_period, 0)
                rent.enough_stock = (rent.quantity <= rent.qty_available_during_period)

    @api.depends('product_id')
    def _compute_is_product_storable(self):
        """Product type ?= storable product."""
        for rent in self:
            rent.is_product_storable = rent.product_id and rent.product_id.type == "product"

    @api.onchange('lot_ids')
    def _onchange_lot_ids(self):
        if len(self.lot_ids) > self.quantity:
            self.quantity = len(self.lot_ids)

    @api.onchange('qty_available_during_period')
    def _onchange_qty_available_during_period(self):
        """If no quantity is available for given period, don't show any choice for the serial numbers."""
        # TODO replace with the use of qty_available_during_period in lot_ids domain?
        if self.qty_available_during_period <= 0:
            return {
                'domain':
                {
                    'lot_ids': [(0, '=', 1)]
                }
            }
        else:
            return {
                'domain':
                {
                    'lot_ids': "['&', ('id', 'not in', rented_lot_ids), ('id', 'in', rentable_lot_ids)]"
                }
            }

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if self.lot_ids and self.lot_ids.mapped('product_id') != self.product_id:
            self.lot_ids = self.env['stock.production.lot']

    @api.constrains('product_id', 'rental_order_line_id')
    def _pickedup_product_no_change(self):
        if self.rental_order_line_id and self.product_id != self.rental_order_line_id.product_id and self.rental_order_line_id.qty_picked_up > 0:
            raise ValidationError(_("You cannot change the product of a picked-up line."))
