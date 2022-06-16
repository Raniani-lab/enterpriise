# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta
from collections import defaultdict

from odoo import fields, models, api, _, Command
from odoo.tools.date_utils import get_timedelta
from odoo.tools import format_date
from odoo.exceptions import ValidationError

INTERVAL_FACTOR = {
    'day': 30.437,  # average number of days per month over the year,
    'week': 30.437 / 7.0,
    'month': 1.0,
    'year': 1.0 / 12.0,
}


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    is_subscription_product = fields.Boolean(related='product_id.recurring_invoice')
    temporal_type = fields.Selection(selection_add=[('subscription', 'Subscription')])
    last_invoice_date = fields.Datetime(string='Last invoice date', compute='_compute_last_invoice_date')
    recurring_monthly = fields.Monetary(compute='_compute_recurring_monthly', string="Monthly Recurring Revenue")
    product_pricing_ids = fields.One2many(related='product_id.product_pricing_ids')
    parent_line_id = fields.Many2one('sale.order.line')
    end_date = fields.Date(related='order_id.end_date')

    def _check_line_unlink(self):
        """ Override. Check wether a line can be deleted or not."""
        undeletable_lines = super()._check_line_unlink()
        not_subscription_lines = self.filtered(lambda line: not line.order_id.is_subscription)
        return not_subscription_lines and undeletable_lines

    @api.depends('start_date', 'next_invoice_date', 'temporal_type', 'order_id.subscription_management')
    def _compute_name(self):
        super()._compute_name()

    def _get_sale_order_line_multiline_description_variants(self):
        """ Add period in description only for upsell """
        res = super()._get_sale_order_line_multiline_description_variants()
        if self.order_id.subscription_management == 'upsell' and self.start_date and self.next_invoice_date:
            # lang is already defined in the context based on the partner
            format_start = format_date(self.env, self.start_date)
            end_period = self.next_invoice_date - relativedelta(days=1) # the period ends the day before the next invoice
            format_next_invoice = format_date(self.env, end_period)
            res += _("\n%s to %s", format_start, format_next_invoice)
        return res

    @api.depends('product_template_id', 'pricing_id')
    def _compute_temporal_type(self):
        super()._compute_temporal_type()
        for line in self:
            if line.product_template_id.recurring_invoice and line.pricing_id:
                line.temporal_type = 'subscription'

    @api.depends('order_id.is_subscription', 'temporal_type')
    def _compute_invoice_status(self):
        super(SaleOrderLine, self)._compute_invoice_status()
        today = fields.Datetime.today()
        for line in self:
            if not line.order_id.is_subscription or line.temporal_type != 'subscription':
                continue
            to_invoice_check = line.next_invoice_date and line.state in ('sale', 'done') and line.next_invoice_date >= today
            if line.end_date:
                to_invoice_check = to_invoice_check and line.order_id.end_date > today.date()
            if to_invoice_check and line.start_date and line.start_date > today:
                line.invoice_status = 'no'

    @api.depends('order_id.is_subscription', 'temporal_type')
    def _compute_start_date(self):
        """ Behave line a default for recurring lines. """
        other_lines = self.env['sale.order.line']
        for line in self:
            if not line.temporal_type == 'subscription':
                other_lines |= line
                continue
            if not line.start_date:
                line.start_date = fields.Datetime.today()
        super(SaleOrderLine, other_lines)._compute_start_date()

    @api.depends('order_id.is_subscription', 'temporal_type', 'start_date', 'pricing_id')
    def _compute_next_invoice_date(self):
        upsell_line_ids = self.env['sale.order.line']
        other_lines = self.env['sale.order.line']
        for line in self:
            if not (line.order_id.is_subscription or line.order_id.subscription_management == 'upsell') and not line.temporal_type == 'subscription':
                line |= other_lines
            elif line.order_id.subscription_management == 'upsell' and line.order_id.subscription_id:
                upsell_line_ids |= line
            elif line.pricing_id and not line.next_invoice_date:
                line.next_invoice_date = line.start_date
        upsell_line_ids._set_upsell_next_invoice_date()
        return super(SaleOrderLine, other_lines)._compute_next_invoice_date()

    def _set_upsell_next_invoice_date(self):
        """ Set the next invoice date according to the other values """
        default_dates = self._get_previous_order_default_dates()
        # set the nid whenever the start_date to have them aligned
        for line in self:
            if line.state in ['sale', 'done']:
                continue
            pricing_id = line.pricing_id
            if not line.pricing_id:
                continue
            if line.parent_line_id.next_invoice_date:
                # We keep the existing value if the line has a parent
                line.next_invoice_date = line.parent_line_id.next_invoice_date
                continue
            order_default_values = default_dates.get(line.order_id, {})
            previous_line_values = order_default_values.get((pricing_id.duration, pricing_id.unit))
            if previous_line_values:
                line.next_invoice_date = previous_line_values and previous_line_values['next_invoice_date']
            # If we have monthly lines and add a new yearly line:
            #  --> we set the nid when the monthly are invoiced
            # If we have yearly lines and add a new monthly line:
            #  --> we let the user decide
            else:
                start_date = line.start_date or fields.Datetime.today()
                naive_nid = line.pricing_id and start_date + get_timedelta(line.pricing_id.duration, line.pricing_id.unit)
                next_invoice_dates = [val['next_invoice_date'] for key, val in order_default_values.items() if val['next_invoice_date'] <= naive_nid]
                if next_invoice_dates:
                    # We only set a value if we have next_invoice_dates available. We let the user define one in the other case
                    line.next_invoice_date = next_invoice_dates[0]

    @api.depends('order_id.subscription_management', 'start_date', 'next_invoice_date')
    def _compute_discount(self):
        default_dates = self.order_id.order_line._get_previous_order_default_dates()
        today = fields.Datetime.today()
        other_lines = self.env['sale.order.line']
        for line in self:
            if line.discount or not line.next_invoice_date or line.temporal_type != 'subscription' or line.order_id.subscription_management != 'upsell':
                other_lines |= line
                continue
            order_default_values = default_dates.get(line.order_id, {})
            period_end = line.next_invoice_date
            if line.parent_line_id: # existing lines
                current_period_start = line.parent_line_id.last_invoice_date or line.parent_line_id.start_date
            else: # use the default values
                previous_line_values = order_default_values.get((line.pricing_id.duration, line.pricing_id.unit))
                if previous_line_values:
                    current_period_start = previous_line_values and previous_line_values['start_date']
                else:
                    # No other line has the current periodicity. We need to get the theoretical start of the period
                    # According to the next_invoice_date value and periodicity
                    period_end = line.pricing_id and line.start_date and line.start_date + get_timedelta(line.pricing_id.duration, line.pricing_id.unit) or line.next_invoice_date
                    current_period_start = today
            time_to_invoice = line.next_invoice_date - today
            if line.next_invoice_date and (period_end - current_period_start).days != 0:
                ratio = float(time_to_invoice.days) / float((period_end - current_period_start).days)
            else:
                ratio = 1
            if ratio < 0 or ratio > 1:
                ratio = 1.00  # Something went wrong in the dates
            if line.order_id.subscription_management == 'upsell' and line.pricing_id and line.next_invoice_date:
                line.discount = (1 - ratio) * 100
        return super(SaleOrderLine, other_lines)._compute_discount()

    # HELPERS
    def _get_previous_order_default_dates(self):
        """ Helper to match the previous invoice dates when creating an upsell or a renew
            It prevents to have different dates of invoices
         """
        default_values = defaultdict(dict)
        # We take the values on the parent_line to avoid using the new lines values during computation
        pricing_dates = defaultdict(dict)
        for line in self:
            previous_line_id = line.parent_line_id
            if not previous_line_id:
                continue
            pricing = (previous_line_id.pricing_id.duration, previous_line_id.pricing_id.unit)
            # start_date is used to compute the prorata discount. It is the beginning of the current period
            start_date = previous_line_id.last_invoice_date or previous_line_id.start_date
            next_invoice_date = previous_line_id.next_invoice_date
            other_line_vals = pricing_dates.get(pricing)
            if other_line_vals and next_invoice_date and other_line_vals['next_invoice_date'] > next_invoice_date:
                # If multiple lines have the same periodicity but different dates, we take the closest one
                next_invoice_date = other_line_vals['next_invoice_date']
                start_date = other_line_vals['start_date']
            pricing_dates[pricing] = {'next_invoice_date': next_invoice_date, 'start_date': start_date}
            default_values[line.order_id] = pricing_dates
        return default_values

    def _update_next_invoice_date(self):
        """ Update the next_invoice_date according to the periodicity of the line.
        At quotation confirmation, last_invoice_date is false, next_invoice is false and start_date is today.
        The next_invoice_date should be bumped up each time an invoice is created except for the first period.
        """
        for line in self.filtered(lambda l: l.temporal_type == 'subscription'):
            last_invoice_date = line.next_invoice_date or line.start_date
            if last_invoice_date:
                line.next_invoice_date = last_invoice_date + get_timedelta(line.pricing_id.duration, line.pricing_id.unit)

    @api.depends('pricing_id')
    def _compute_price_unit(self):
        super()._compute_price_unit()

    @api.depends('product_id')
    def _compute_pricing(self):
        non_subscription_lines = self.env['sale.order.line']
        previous_lines = self.order_id.order_line.filtered('is_subscription_product')
        # search pricing_ids for each variant in self
        available_pricing_ids = self.env['product.pricing'].search([
            ('product_template_id', 'in', self.product_id.product_tmpl_id.ids),
            '|',
            ('product_variant_ids', 'in', self.product_id.ids),
            ('product_variant_ids', '=', False),
            '|',
            ('pricelist_id', 'in', self.order_id.pricelist_id.ids),
            ('pricelist_id', '=', False)
        ])

        for line in self:
            if not line.is_subscription_product:
                non_subscription_lines |= line
                continue
            if line.id:
                # We don't compute pricings for existing lines. This compute is only used for default values of new lines
                continue
            other_lines = previous_lines.filtered(lambda l: l.order_id == line.order_id) - line
            latest_pricing_id = other_lines and other_lines[-1].pricing_id
            best_pricing_id = available_pricing_ids.filtered(
                lambda pricing:
                    line.product_id.product_tmpl_id == pricing.product_template_id and (
                        line.product_id in pricing.product_variant_ids or not pricing.product_variant_ids
                    ) and (line.order_id.pricelist_id == pricing.pricelist_id or not pricing.pricelist_id)
            )[:1]
            if latest_pricing_id:
                pricing_match = line.product_id._get_best_pricing_rule(duration=latest_pricing_id.duration,
                                                                       unit=latest_pricing_id.unit)
                if (pricing_match.duration, pricing_match.unit) == (latest_pricing_id.duration, latest_pricing_id.unit):
                    best_pricing_id = pricing_match
            line.pricing_id = best_pricing_id.id
        super(SaleOrderLine, non_subscription_lines)._compute_pricing()

    @api.depends('start_date', 'order_id.state', 'invoice_lines')
    def _compute_last_invoice_date(self):
        for line in self:
            if line.pricing_id and line.order_id.state in ['sale', 'done'] and line.invoice_lines:
                # we use get_timedelta and not the effective invoice date because
                # we don't want gaps. Invoicing date could be shifted because of technical issues.
                line.last_invoice_date = line.next_invoice_date and line.next_invoice_date - get_timedelta(line.pricing_id.duration, line.pricing_id.unit)
            else:
                line.last_invoice_date = False

    @api.depends('temporal_type', 'invoice_lines.subscription_start_date', 'invoice_lines.subscription_end_date',
                 'next_invoice_date', 'last_invoice_date')
    def _compute_qty_to_invoice(self):
        return super()._compute_qty_to_invoice()

    def _get_invoice_lines(self):
        self.ensure_one()
        if self.temporal_type != 'subscription':
            return super()._get_invoice_lines()
        else:
            last_invoice_date = self.last_invoice_date or self.start_date
            invoice_line = self.invoice_lines.filtered(
                lambda line: line.date and last_invoice_date and line.date > last_invoice_date.date())
            return invoice_line

    def _get_subscription_qty_to_invoice(self, last_invoice_date=False, next_invoice_date=False):
        result = {}
        qty_invoiced = self._get_subscription_qty_invoiced(last_invoice_date, next_invoice_date)
        for line in self:
            if line.temporal_type != 'subscription' or line.state not in ['sale', 'done']:
                continue
            if line.product_id.invoice_policy == 'order':
                result[line.id] = line.product_uom_qty - qty_invoiced.get(line.id, 0.0)
            else:
                result[line.id] = line.qty_delivered - qty_invoiced.get(line.id, 0.0)
        return result

    def _get_subscription_qty_invoiced(self, last_invoice_date=None, next_invoice_date=None):
        result = {}
        for line in self:
            if line.temporal_type != 'subscription' or line.order_id.state not in ['sale', 'done']:
                continue
            qty_invoiced = 0.0
            last_period_start = line.next_invoice_date and line.pricing_id and line.next_invoice_date - get_timedelta(line.pricing_id.duration, line.pricing_id.unit)
            start_date = last_invoice_date or last_period_start and last_period_start.date()
            end_date = next_invoice_date or line.next_invoice_date and line.next_invoice_date.date()
            day_before_end_date = end_date - relativedelta(days=1)
            related_invoice_lines = line.invoice_lines.filtered(
                lambda l: l.move_id.state != 'cancel' and \
                          l.id in line.invoice_lines.ids and \
                          l.subscription_start_date == start_date and
                          l.subscription_end_date == day_before_end_date)
            for invoice_line in related_invoice_lines:
                qty_invoiced += invoice_line.product_uom_id._compute_quantity(invoice_line.quantity, line.product_uom)
            result[line.id] = qty_invoiced
        return result

    @api.depends('temporal_type', 'invoice_lines', 'invoice_lines.subscription_start_date',
                 'invoice_lines.subscription_end_date', 'next_invoice_date', 'last_invoice_date')
    def _compute_qty_invoiced(self):
        other_lines = self.env['sale.order.line']
        subscription_qty_invoiced = self._get_subscription_qty_invoiced()
        for line in self:
            if line.temporal_type != 'subscription':
                other_lines |= line
                continue
            line.qty_invoiced = subscription_qty_invoiced.get(line.id, 0.0)
        super(SaleOrderLine, other_lines)._compute_qty_invoiced()

    @api.depends('temporal_type', 'price_subtotal', 'pricing_id')
    def _compute_recurring_monthly(self):
        subscription_lines = self.filtered(lambda l: l.temporal_type == 'subscription')
        for line in subscription_lines:
            if line.pricing_id.unit not in INTERVAL_FACTOR.keys():
                raise ValidationError(_("The time unit cannot be used. Please chose one of these unit: %s.",
                                        ", ".join(['Month, Year', 'One Time'])))
            line.recurring_monthly = line.price_subtotal * INTERVAL_FACTOR[line.pricing_id.unit] / line.pricing_id.duration
        (self - subscription_lines).recurring_monthly = 0

    def _periodicity_update_log(self, values):
        new_pricing = self.env['product.pricing'].browse(values['pricing_id'])
        for order in self.mapped('order_id'):
            order_lines = self.filtered(lambda x: x.order_id == order)
            line_values = [{'name': line.product_id.display_name, 'old_pricing': line.pricing_id, 'new_pricing': new_pricing} for line in order_lines]
            order.message_post_with_view('sale_subscription.sol_pricing_update', values={'line_values': line_values})

    def _prepare_invoice_line(self, **optional_values):
        self.ensure_one()
        res = super()._prepare_invoice_line(**optional_values)
        if self.temporal_type == 'subscription':
            product_desc = self.product_id.get_product_multiline_description_sale() + self._get_sale_order_line_multiline_description_variants()
            description = _("%(product)s - %(duration)d %(unit)s",
                            product=product_desc,
                            duration=round(self.pricing_id.duration),
                            unit=self.pricing_id.unit)
            lang_code = self.order_id.partner_id.lang
            if self.invoice_lines:
                # We need to invoice the next period: last_invoice_date will be today once this invoice is created. We use get_timedelta to avoid gaps
                new_period_start = self.next_invoice_date
            else:
                # First invoice for a given period. This period may start today
                new_period_start = self.start_date or fields.Datetime.today()
            format_start = format_date(self.env, new_period_start, lang_code=lang_code)
            default_next_invoice_date = new_period_start + get_timedelta(self.pricing_id.duration, self.pricing_id.unit)
            if self.order_id.subscription_management == 'upsell':
                # remove 1 day as normal people thinks in terms of inclusive ranges.
                next_invoice_date = self.next_invoice_date - relativedelta(days=1)
            else:
                # remove 1 day as normal people thinks in terms of inclusive ranges.
                next_invoice_date = default_next_invoice_date - relativedelta(days=1)
                format_invoice = format_date(self.env, next_invoice_date, lang_code=lang_code)
                description += _("\n%s to %s", format_start, format_invoice)
            qty_to_invoice = self._get_subscription_qty_to_invoice(last_invoice_date=new_period_start,
                                                                   next_invoice_date=next_invoice_date)
            subscription_end_date = next_invoice_date
            res['quantity'] = qty_to_invoice.get(self.id, 0.0)

            batch_tag_id = self.env["ir.model.data"]._xmlid_to_res_id("sale_subscription.recurring_trigger_tag", raise_if_not_found=False)
            useful_tag_ids = self.order_id.account_tag_ids.ids
            if useful_tag_ids and useful_tag_ids != [batch_tag_id]:
                res.update({'analytic_tag_ids': [Command.link(t_id) for t_id in useful_tag_ids if t_id != batch_tag_id]})
            res.update({
                'name': description,
                'subscription_start_date': new_period_start,
                'subscription_end_date': subscription_end_date,
                'subscription_id': self.order_id.id
            })
        return res

    @api.model
    def update_pricing_all_lines(self, new_pricing, pricelist_id, lines_data):
        """ This method aims to update all the pricing of sol according to periodicity set on the new_pricing value
        :param new_pricing: pricing_id used to set the periodicity on other SOL
        :param lines_data: ductionnary of line id and product template_id
        :return: {line.id: pricing.id for product_id set on the line which match the periodicity of new_pricing.id}
        """
        if not new_pricing:
            return {'error': True}
        new_pricing_id = self.env['product.pricing'].browse(new_pricing['id'])
        pricelist = self.env['product.product'].browse(pricelist_id)
        result = {}
        for line in lines_data:
            product_id = self.env['product.product'].browse(line['product_id'])
            line_pricing_id = product_id._get_best_pricing_rule(duration=new_pricing_id.duration, unit=new_pricing_id.unit, pricelist=pricelist)
            if line_pricing_id:
                result[line['id']] = {'id': line_pricing_id.id, 'display_name': line_pricing_id.name}
        return result

    def _reset_subscription_qty_to_invoice(self):
        """ Define the qty to invoice on subscription lines equal to product_uom_qty for recurring lines
            It allows avoiding using the _compute_qty_to_invoice with a context_today
        """
        today = fields.Datetime.today()
        for line in self:
            if not line.temporal_type == 'subscription' or line.product_id.invoice_policy == 'delivery' or line.start_date and line.start_date > today:
                continue
            line.qty_to_invoice = line.product_uom_qty

    def _reset_subscription_quantity_post_invoice(self):
        """ Update the Delivered quantity value of recurring line according to the periods
        """
        # arj todo: reset only timesheet things. So reset nothing in standard but override in sale-subscription_timesheet (to be recreated...)
        return

    ####################
    # CRUD             #
    ####################

    def write(self, values):
        if 'pricing_id' in values:
            self.filtered(lambda r: r.state == 'sale')._periodicity_update_log(values)
        res = super().write(values)
        return res

    ####################
    # Business Methods #
    ####################

    def _get_renew_upsell_values(self, subscription_management):
        order_lines = []
        today = fields.Datetime.today()
        for line in self.filtered(lambda l: l.temporal_type == 'subscription'):
            partner_lang = line.order_id.partner_id.lang
            line = line.with_context(lang=partner_lang) if partner_lang else line
            product = line.product_id
            if subscription_management == 'upsell':
                quantity = 0
                next_invoice_date = line.next_invoice_date
                line_start = today
            else:
                line_start = line.next_invoice_date
                quantity = line.product_uom_qty
                next_invoice_date = line_start + get_timedelta(line.pricing_id.duration, line.pricing_id.unit)

            order_lines.append((0, 0, {
                'parent_line_id': line.id,
                'temporal_type': 'subscription',
                'product_id': product.id,
                'product_uom': line.product_uom.id,
                'product_uom_qty': quantity,
                'price_unit': line.price_unit,
                'start_date': line_start,
                'next_invoice_date': next_invoice_date,
                'pricing_id': line.pricing_id.id
            }))
        return order_lines

    def _subscription_update_line_data(self, subscription):
        """
        Prepare a dictionary of values to add or update lines on a subscription.
        :return: order_line values to create or update the subscription
        """
        update_values = []
        create_values = []
        dict_changes = {}
        for line in self:
            sub_line = line.parent_line_id
            if sub_line:
                # We have already a subscription line, we need to modify the product quantity
                if len(sub_line) > 1:
                    # we are in an ambiguous case
                    # to avoid adding information to a random line, in that case we create a new line
                    # we can simply duplicate an arbitrary line to that effect
                    sub_line[0].copy({'name': line.display_name, 'product_uom_qty': line.product_uom_qty})
                elif line.product_uom_qty != 0:
                    dict_changes.setdefault(sub_line.id, sub_line.product_uom_qty)
                    # upsell, we add the product to the existing quantity
                    dict_changes[sub_line.id] += line.product_uom_qty
            else:
                # we create a new line in the subscription:
                start_date = False
                next_invoice_date = False
                if line.temporal_type == 'subscription':
                    start_date = line.start_date or fields.Datetime.today()
                    next_invoice_date = line.next_invoice_date
                create_values.append(Command.create({
                    'product_id': line.product_id.id,
                    'name': line.name,
                    'product_uom_qty': line.product_uom_qty,
                    'product_uom': line.product_uom.id,
                    'price_unit': line.price_unit,
                    'discount': 0,
                    'pricing_id': line.pricing_id.id,
                    'start_date': start_date,
                    'next_invoice_date': next_invoice_date,
                    'order_id': subscription.id
                }))
        update_values += [(1, sub_id, {'product_uom_qty': dict_changes[sub_id]}) for sub_id in dict_changes]
        return create_values, update_values

    #=== PRICE COMPUTING HOOKS ===#

    def _get_price_computing_kwargs(self):
        """ Override to add the pricing duration or the start and end date of temporal line """
        price_computing_kwargs = super()._get_price_computing_kwargs()
        if self.temporal_type != 'subscription':
            return price_computing_kwargs
        if self.pricing_id:
            price_computing_kwargs['duration'] = self.pricing_id.duration
            price_computing_kwargs['unit'] = self.pricing_id.unit
        return price_computing_kwargs
