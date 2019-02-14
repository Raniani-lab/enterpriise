# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta
from odoo import api, fields, models, _
from odoo.tools import float_compare
from odoo.addons.mail.models.mail_template import format_tz


class RentalOrder(models.Model):
    _inherit = 'sale.order'

    is_rental_order = fields.Boolean("Created In App Rental")
    rental_status = fields.Selection([
        ('draft', 'Quotation'),
        ('sent', 'Quotation Sent'),
        ('pickup', 'Reserved'),
        ('return', 'Picked-Up'),
        ('returned', 'Returned'),
        ('cancel', 'Cancelled'),
    ], string="Rental Status", compute='_compute_rental_status', store=True)

    has_pickable_lines = fields.Boolean(compute="_compute_rental_status", store=True)
    has_returnable_lines = fields.Boolean(compute="_compute_rental_status", store=True)
    next_action_date = fields.Datetime(
        string="Rental Next Action Date", compute='_compute_rental_status', store=True)

    has_late_lines = fields.Boolean(compute="_compute_has_late_lines")

    @api.depends('is_rental_order', 'next_action_date', 'rental_status')
    def _compute_has_late_lines(self):
        for order in self:
            order.has_late_lines = (
                order.is_rental_order
                and order.rental_status in ['pickup', 'return']  # has_pickable_lines or has_returnable_lines
                and order.next_action_date < fields.Datetime.now())

    @api.depends('state', 'order_line', 'order_line.product_uom_qty', 'order_line.qty_picked_up', 'order_line.qty_delivered')
    def _compute_rental_status(self):
        # TODO replace multiple assignations by one write?
        for order in self:
            if order.state in ['sale', 'done'] and order.is_rental_order:
                rental_order_lines = order.order_line.filtered('is_rental')
                pickeable_lines = rental_order_lines.filtered(lambda sol: sol.qty_picked_up < sol.product_uom_qty)
                returnable_lines = rental_order_lines.filtered(lambda sol: sol.qty_delivered < sol.qty_picked_up)
                min_pickup_date = min(pickeable_lines.mapped('pickup_date')) if pickeable_lines else 0
                min_return_date = min(returnable_lines.mapped('return_date')) if returnable_lines else 0
                if pickeable_lines and (not returnable_lines or min_pickup_date <= min_return_date):
                    order.rental_status = 'pickup'
                    order.next_action_date = min_pickup_date
                elif returnable_lines:
                    order.rental_status = 'return'
                    order.next_action_date = min_return_date
                else:
                    order.rental_status = 'returned'
                order.has_pickable_lines = bool(pickeable_lines)
                order.has_returnable_lines = bool(returnable_lines)
            else:
                order.has_pickable_lines = False
                order.has_returnable_lines = False
                order.rental_status = order.state if order.is_rental_order else False

    # PICKUP / RETURN : rental.processing wizard

    def open_pickup(self):
        status = "pickup"
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        lines_to_pickup = self.order_line.filtered(
            lambda r: r.state in ['sale', 'done'] and r.is_rental and float_compare(r.product_uom_qty, r.qty_picked_up, precision_digits=precision) > 0)
        return self._open_rental_wizard(status, lines_to_pickup.ids)

    def open_return(self):
        status = "return"
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        lines_to_return = self.order_line.filtered(
            lambda r: r.state in ['sale', 'done'] and r.is_rental and float_compare(r.qty_picked_up, r.qty_delivered, precision_digits=precision) > 0)
        return self._open_rental_wizard(status, lines_to_return.ids)

    def _open_rental_wizard(self, status, order_line_ids):
        context = {
            'order_line_ids': order_line_ids,
            'default_status': status,
            'default_order_id': self.id,
        }
        return {
            'name': _('Validate a pickup') if status == 'pickup' else _('Validate a return'),
            'view_mode': 'form',
            'res_model': 'rental.order.wizard',
            'type': 'ir.actions.act_window',
            'target': 'new',
            'context': context
        }


class RentalOrderLine(models.Model):
    _inherit = 'sale.order.line'

    is_rental = fields.Boolean(default=False)  # change to compute if pickup_date and return_date set?

    qty_picked_up = fields.Float("Picked-up", default=0.0, copy=False)
    # returned_quantity = qty_delivered

    pickup_date = fields.Datetime(string="Pickup")
    return_date = fields.Datetime(string="Return")
    reservation_begin = fields.Datetime("Pickup date - padding time", compute='_compute_reservation_begin', store=True)

    is_late = fields.Boolean(string="Is overdue", compute="_compute_is_late", help="The products haven't been returned in time")

    is_product_rentable = fields.Boolean(related='product_id.rent_ok')
    rental_updatable = fields.Boolean(compute='_compute_rental_updatable')
    # TODO use is_product_rentable in rental_configurator_widget instead of rpc call?

    @api.depends('return_date')
    def _compute_is_late(self):
        now = fields.Datetime.now()
        for line in self:
            # By default, an order line is considered late only if it has one hour of delay
            line.is_late = line.return_date and line.return_date + timedelta(hours=self.company_id.min_extra_hour) < now

    @api.depends('pickup_date', 'product_id.preparation_time')
    def _compute_reservation_begin(self):
        for line in self.filtered(lambda line: line.is_rental):
            padding_timedelta_before = timedelta(hours=line.product_id.preparation_time)
            line.reservation_begin = line.pickup_date - padding_timedelta_before


    @api.depends('state', 'qty_invoiced', 'qty_delivered')
    def _compute_rental_updatable(self):
        rental_lines = self.filtered('is_rental')
        sale_lines = self - rental_lines
        for line in sale_lines:
            line.rental_updatable = line.product_updatable
        for line in rental_lines:
            if line.state == 'cancel' or (line.state in ['sale', 'done'] and (line.qty_invoiced > 0 or line.qty_delivered > 0)):
                line.rental_updatable = False
            else:
                line.rental_updatable = True

    @api.onchange('product_id')
    def _onchange_product_id(self):
        """Clean rental related data if new product cannot be rented."""
        if (not self.is_product_rentable) and self.is_rental:
            self.update({
                'is_rental': False,
                'pickup_date': False,
                'return_date': False,
            })

    @api.onchange('qty_picked_up')
    def _onchange_qty_picked_up(self):
        """When picking up more than reserved, reserved qty is updated"""
        if self.qty_picked_up > self.product_uom_qty:
            self.product_uom_qty = self.qty_picked_up

    @api.onchange('pickup_date', 'return_date')
    def _onchange_rental_info(self):
        """Trigger description recomputation"""
        self.product_id_change()

    _sql_constraints = [
        ('rental_reservation_coherence',
            "CHECK(qty_picked_up <= product_uom_qty)",
            "Please make sure that the ordered quantity is not smaller than the picked-up quantity."),
        ('rental_stock_coherence',
            "CHECK(NOT is_rental OR qty_delivered <= qty_picked_up)",
            "You cannot return more than what has been picked up."),
        ('rental_period_coherence',
            "CHECK(NOT is_rental OR pickup_date < return_date)",
            "Please choose a return date that is after the pickup date."),
    ]

    def get_sale_order_line_multiline_description_sale(self, product):
        """Add Rental information to the SaleOrderLine name."""
        return super(RentalOrderLine, self).get_sale_order_line_multiline_description_sale(product) + self.get_rental_order_line_description()

    def get_rental_order_line_description(self):
        if (self.is_rental):
            return "\n%s %s\n%s %s" % (
                _("Rental from"),
                format_tz(self.with_context(use_babel=True).env, self.pickup_date, tz=self.env.user.tz, format='short'),
                _("to"),
                format_tz(self.with_context(use_babel=True).env, self.return_date, tz=self.env.user.tz, format='short'),
            )
        else:
            return ""

    @api.multi
    def _get_display_price(self, product):
        """Ensure unit price isn't recomputed."""
        if self.is_rental:
            return self.price_unit
        else:
            return super(RentalOrderLine, self)._get_display_price(product)

    @api.multi
    def _generate_delay_line(self, qty):
        """Generate a sale order line representing the delay cost due to the late return.

        :param float qty:
        :param timedelta duration:
        """
        self.ensure_one()
        if qty <= 0 or not self.is_late:
            return

        duration = fields.Datetime.now() - self.return_date

        delay_price = self.product_id._compute_delay_price(duration)
        if delay_price <= 0.0:
            return

        # migrate to a function on res_company get_extra_product?
        delay_product = self.company_id.extra_product
        if not delay_product:
            delay_product = self.env['product.product'].with_context(active_test=False).search(
                [('default_code', '=', 'RENTAL'), ('type', '=', 'service')], limit=1)
            if not delay_product:
                delay_product = self.env['product.product'].create({
                    "name": "Rental Delay Cost",
                    "standard_price": 0.0,
                    "type": 'service',
                    "default_code": "RENTAL",
                    "purchase_ok": False,
                    # set active to False to only use and show it for Rental?
                })
            self.company_id.extra_product = delay_product

        if not delay_product.active:
            return

        vals = self._prepare_delay_line_vals(delay_product, delay_price, qty)

        self.order_id.write({
            'order_line': [(0, 0, vals)]
        })

    def _prepare_delay_line_vals(self, delay_product, delay_price, qty):
        """Prepare values of delay line.

        :param float delay_price:
        :param float quantity:
        :param delay_product: Product used for the delay_line
        :type delay_product: product.product
        :return: sale.order.line creation values
        :rtype dict:
        """
        delay_line_description = self._get_delay_line_description()
        return {
            'name': delay_line_description,
            'product_id': delay_product.id,
            'product_uom_qty': qty,
            'product_uom': self.product_id.uom_id.id,
            'qty_delivered': qty,
            'price_unit': delay_price,
        }

    def _get_delay_line_description(self):
        # Shouldn't tz be taken from self.order_id.user_id.tz ?
        return "%s\n%s: %s\n%s: %s" % (
            self.product_id.name,
            _("Expected"),
            format_tz(self.with_context(use_babel=True).env, self.pickup_date, tz=self.env.user.tz, format='short'),
            _("Returned"),
            format_tz(self.with_context(use_babel=True).env, fields.Datetime.now(), tz=self.env.user.tz, format='short')
        )
