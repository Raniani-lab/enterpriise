# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from pytz import timezone, UTC

from odoo import _, api, fields, models
from odoo.fields import Command
from odoo.tools import format_datetime, format_time


class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    # Stored because a product could have been rent_ok when added to the SO but then updated
    is_rental = fields.Boolean(compute='_compute_is_rental', store=True, precompute=True)

    qty_returned = fields.Float("Returned", default=0.0, copy=False)
    start_date = fields.Datetime(related='order_id.rental_start_date')
    return_date = fields.Datetime(related='order_id.rental_return_date')
    reservation_begin = fields.Datetime(
        string="Pickup date - padding time", compute='_compute_reservation_begin', store=True)

    is_product_rentable = fields.Boolean(related='product_id.rent_ok', depends=['product_id'])
    temporal_type = fields.Selection(selection_add=[('rental', 'Rental')])

    @api.depends('product_template_id', 'is_rental')
    def _compute_temporal_type(self):
        super()._compute_temporal_type()
        for line in self:
            # We only rely on the is_rental stored boolean because after migration, product could be migrated
            # with rent_ok = False It will ensure that rental line are still considered rental even if the product change
            # To compare with subscription where temporal type depends on recurrency and recurring_invoice
            if line.is_rental:
                line.temporal_type = 'rental'

    @api.depends('order_id.rental_start_date')
    def _compute_reservation_begin(self):
        lines = self.filtered('is_rental')
        for line in lines:
            line.reservation_begin = line.order_id.rental_start_date
        (self - lines).reservation_begin = None

    @api.onchange('qty_delivered')
    def _onchange_qty_delivered(self):
        """When picking up more than reserved, reserved qty is updated"""
        if self.qty_delivered > self.product_uom_qty:
            self.product_uom_qty = self.qty_delivered

    @api.depends('is_rental')
    def _compute_qty_delivered_method(self):
        """Allow modification of delivered qty without depending on stock moves."""
        rental_lines = self.filtered('is_rental')
        super(SaleOrderLine, self - rental_lines)._compute_qty_delivered_method()
        rental_lines.qty_delivered_method = 'manual'

    @api.depends('order_id.rental_start_date', 'order_id.rental_return_date', 'is_rental')
    def _compute_name(self):
        """Override to add the compute dependency.

        The custom name logic can be found below in _get_sale_order_line_multiline_description_sale.
        """
        super()._compute_name()

    @api.depends('product_id')
    def _compute_is_rental(self):
        for line in self:
            line.is_rental = line.is_product_rentable and line.env.context.get('in_rental_app')

    _sql_constraints = [
        ('rental_stock_coherence',
            "CHECK(NOT is_rental OR qty_returned <= qty_delivered)",
            "You cannot return more than what has been picked up."),
    ]

    def _get_sale_order_line_multiline_description_sale(self):
        """Add Rental information to the SaleOrderLine name."""
        res = super()._get_sale_order_line_multiline_description_sale()
        if self.is_rental:
            self.order_id._rental_set_dates()
            res += self._get_rental_order_line_description()
        return res

    def _get_rental_order_line_description(self):
        tz = self._get_tz()
        start_date = self.order_id.rental_start_date
        return_date = self.order_id.rental_return_date
        env = self.with_context(use_babel=True).env
        if start_date and return_date\
           and start_date.replace(tzinfo=UTC).astimezone(timezone(tz)).date()\
               == return_date.replace(tzinfo=UTC).astimezone(timezone(tz)).date():
            # If return day is the same as pickup day, don't display return_date Y/M/D in description.
            return_date_part = format_time(env, return_date, tz=tz, time_format=False)
        else:
            return_date_part = format_datetime(env, return_date, tz=tz, dt_format=False)
        start_date_part = format_datetime(env, start_date, tz=tz, dt_format=False)
        return _(
            "\n%(from_date)s to %(to_date)s", from_date=start_date_part, to_date=return_date_part
        )

    def _use_template_name(self):
        """ Avoid the template line description in order to add the rental period on the SOL. """
        if self.is_rental:
            return False
        return super()._use_template_name()

    def _generate_delay_line(self, qty_returned):
        """Generate a sale order line representing the delay cost due to the late return.

        :param float qty_returned: returned quantity
        """
        self.ensure_one()

        self = self.with_company(self.company_id)
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
                })
                # Not set to inactive to allow users to put it back in the settings
                # In case they removed it.
            self.company_id.extra_product = delay_product

        if not delay_product.active:
            return

        delay_price = self._convert_to_sol_currency(delay_price, self.product_id.currency_id)

        order_line_vals = self._prepare_delay_line_vals(delay_product, delay_price * qty_returned)

        self.order_id.write({
            'order_line': [Command.create(order_line_vals)],
        })

    def _prepare_delay_line_vals(self, delay_product, delay_price):
        """Prepare values of delay line.

        :param product.product delay_product: Product used for the delay_line
        :param float delay_price: Price of the delay line

        :return: sale.order.line creation values
        :rtype dict:
        """
        delay_line_description = self._get_delay_line_description()
        return {
            'name': delay_line_description,
            'product_id': delay_product.id,
            'product_uom_qty': 1,
            'qty_delivered': 1,
            'price_unit': delay_price,
        }

    def _get_delay_line_description(self):
        # Shouldn't tz be taken from self.order_id.user_id.tz ?
        tz = self._get_tz()
        env = self.with_context(use_babel=True).env
        expected_date = format_datetime(env, self.return_date, tz=tz, dt_format=False)
        now = format_datetime(env, fields.Datetime.now(), tz=tz, dt_format=False)
        return "%s\n%s\n%s" % (
            self.product_id.name,
            _("Expected: %(date)s", date=expected_date),
            _("Returned: %(date)s", date=now),
        )

    def _get_tz(self):
        return self.env.context.get('tz') or self.env.user.tz or 'UTC'

    # === PRICE COMPUTING HOOKS === #

    def _get_price_computing_kwargs(self):
        """ Override to add the pricing duration or the start and end date of temporal line """
        price_computing_kwargs = super()._get_price_computing_kwargs()
        if self.temporal_type != 'rental':
            return price_computing_kwargs
        self.order_id._rental_set_dates()
        start_date = self.order_id.rental_start_date
        return_date = self.order_id.rental_return_date
        if start_date and return_date:
            price_computing_kwargs['start_date'] = start_date
            price_computing_kwargs['end_date'] = return_date
        return price_computing_kwargs

    def _lines_without_price_recomputation(self):
        """ Override to filter out rental lines and allow the recomputation for these SOL. """
        res = super()._lines_without_price_recomputation()
        return res.filtered(lambda l: not l.is_rental)

    def _get_action_add_from_catalog_extra_context(self, order):
        """ Override to add rental dates in the context for product availabilities. """
        extra_context = super()._get_action_add_from_catalog_extra_context(order)
        extra_context.update(start_date=order.rental_start_date, end_date=order.rental_return_date)
        return extra_context
