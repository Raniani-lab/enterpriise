# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta

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

    @api.depends('product_template_id', 'pricing_id')
    def _compute_temporal_type(self):
        super()._compute_temporal_type()
        for line in self:
            if line.product_template_id.recurring_invoice and line.pricing_id:
                line.temporal_type = 'subscription'

    @api.depends('order_id.is_subscription', 'temporal_type')
    def _compute_invoice_status(self):
        subscription_lines = self.filtered(lambda l: l.order_id.is_subscription and l.temporal_type == 'subscription')
        super(SaleOrderLine, self - subscription_lines)._compute_invoice_status()
        today = fields.Datetime.today()
        for line in subscription_lines:
            to_invoice_check = line.next_invoice_date and line.order_id.end_date and line.state in ('sale', 'done')
            if to_invoice_check and line.next_invoice_date >= today and line.order_id.end_date > today.date():
                line.invoice_status = 'to invoice'

    @api.depends('order_id.is_subscription', 'temporal_type', 'pricing_id')
    def _compute_start_date(self):
        """ Behave line a default for recurring lines. """
        subscription_lines = self.filtered(lambda l: (l.order_id.is_subscription or l.order_id.subscription_management == 'upsell') and l.temporal_type == 'subscription')
        super(SaleOrderLine, self - subscription_lines)._compute_start_date()
        for line in subscription_lines:
            if not line.start_date:
                line.start_date = fields.Datetime.today()

    @api.depends('order_id.is_subscription', 'temporal_type', 'start_date', 'pricing_id')
    def _compute_next_invoice_date(self):
        subscription_lines = self.filtered(lambda l: (l.order_id.is_subscription or l.order_id.subscription_management == 'upsell') and l.temporal_type == 'subscription')
        super(SaleOrderLine, self - subscription_lines)._compute_next_invoice_date()
        for line in subscription_lines:
            # This only works if one change the start_date, save the record* and then change the next_invoice_date.
            update_allowed = line._origin.pricing_id != line.pricing_id or line.start_date != line._origin.start_date
            if line.pricing_id.unit and line.pricing_id.duration and update_allowed:
                line.next_invoice_date = line.start_date and line.start_date + get_timedelta(line.pricing_id.duration, line.pricing_id.unit)

    def _update_next_invoice_date(self, force=False):
        """ Update the next_invoice_date according to the periodicity of the line.
        At quotation confirmation, last_invoice_date is false, next_invoice is false and start_date is today.
        The next_invoice_date should be bumped up each time an invoice is created except for the first period.
        """
        today = fields.Datetime.today()
        for line in self.filtered(lambda l: l.temporal_type == 'subscription'):
            # don't update next_invoice date if the invoice_count is 0. First period invoiced: the next_invoice_date was set by the confirm action
            update_needed = line.order_id.invoice_count > 1 or (line.next_invoice_date and line.next_invoice_date <= today)
            if force or update_needed:
                last_invoice_date = line.next_invoice_date or line.start_date
                if last_invoice_date:
                    line.next_invoice_date = last_invoice_date + get_timedelta(line.pricing_id.duration, line.pricing_id.unit)

    @api.depends('pricing_id')
    def _compute_price_unit(self):
        super()._compute_price_unit()

    @api.depends('product_id')
    def _compute_pricing(self):
        subscription_lines = self.filtered('is_subscription_product')
        super(SaleOrderLine, self - subscription_lines)._compute_pricing()
        previous_lines = self.order_id.order_line.filtered('is_subscription_product')
        for line in subscription_lines:
            other_lines = previous_lines.filtered(lambda l: l.order_id == line.order_id) - line
            latest_pricing_id = other_lines and other_lines[-1].pricing_id
            if latest_pricing_id:
                best_pricing_id = line.product_id._get_best_pricing_rule(duration=latest_pricing_id.duration, unit=latest_pricing_id.unit)
                if (best_pricing_id.duration, best_pricing_id.unit) == (latest_pricing_id.duration, latest_pricing_id.unit):
                    line.pricing_id = best_pricing_id.id

    @api.depends('start_date', 'order_id.state', 'invoice_lines')
    def _compute_last_invoice_date(self):
        for line in self:
            if line.pricing_id and line.order_id.state in ['sale', 'done'] and line.invoice_lines:
                line.last_invoice_date = line.next_invoice_date and line.next_invoice_date - get_timedelta(line.pricing_id.duration, line.pricing_id.unit)
            else:
                line.last_invoice_date = False

    @api.depends('temporal_type', 'invoice_lines.subscription_start_date', 'invoice_lines.subscription_end_date', 'next_invoice_date', 'last_invoice_date')
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
            start_date = last_invoice_date or line.last_invoice_date and line.last_invoice_date.date()
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

    @api.depends('temporal_type', 'invoice_lines', 'invoice_lines.subscription_start_date', 'invoice_lines.subscription_end_date', 'next_invoice_date', 'last_invoice_date')
    def _compute_qty_invoiced(self):
        non_subscription_lines = self.filtered(lambda l: l.temporal_type != 'subscription')
        super(SaleOrderLine, non_subscription_lines)._compute_qty_invoiced()
        subscription_qty_invoiced = self._get_subscription_qty_invoiced()
        for line in self.filtered(lambda l: l.temporal_type == 'subscription'):
            line.qty_invoiced = subscription_qty_invoiced.get(line.id, 0.0)

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
            if self.order_id.subscription_management == 'upsell' and self.parent_line_id.next_invoice_date:
                next_invoice_date = self.parent_line_id.next_invoice_date
            else:
                next_invoice_date = default_next_invoice_date
            format_invoice = format_date(self.env, next_invoice_date, lang_code=lang_code)
            description += _("\n%s to %s", format_start, format_invoice)
            qty_to_invoice = self._get_subscription_qty_to_invoice(last_invoice_date=new_period_start,
                                                                   next_invoice_date=next_invoice_date)
            subscription_end_date = next_invoice_date - relativedelta(days=1) # remove 1 day as normal people thinks in terms of inclusive ranges.
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

    ####################
    # CRUD             #
    ####################

    @api.model_create_multi
    def create(self, val_list):
        new_lines = super().create(val_list)
        confirmed_lines = new_lines.filtered(lambda line: line.order_id.state in ['sale', 'done'] and not line.display_type)
        confirmed_lines._update_next_invoice_date(force=True)
        return new_lines

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
            quantity = 0
            product = line.product_id
            if subscription_management == 'upsell':
                # calculate unit price according to prorata.
                time_to_invoice = line.next_invoice_date - today
                # Copy last_invoice_date from subscription, start date if needed and start today if the line was created in the upsell order
                current_period_start = line.last_invoice_date or line.start_date or today
                next_invoice_date = line.next_invoice_date
                ratio = float(time_to_invoice.days) / float((line.next_invoice_date - current_period_start).days)
                if ratio < 0 or ratio > 1:
                    ratio = 1.00 # Something went wrong in the dates
                discount = (1 - ratio) * 100
                line_start = today
                line_name = line.with_context(lang=partner_lang)._get_sale_order_line_multiline_description_sale()
                format_start = format_date(self.env, today, lang_code=partner_lang)
                end_period = next_invoice_date - relativedelta(days=1)
                format_next_invoice = format_date(self.env, end_period, lang_code=partner_lang)
                line_name += _("\n%s to %s", format_start, format_next_invoice)
            else:
                # renew: all the periods will start at the end of their current next_invoice_date value
                discount = 0
                line_start = line.next_invoice_date
                next_invoice_date = line_start + get_timedelta(line.pricing_id.duration, line.pricing_id.unit)
                line_name = line.with_context(lang=partner_lang)._get_sale_order_line_multiline_description_sale()

            order_lines.append((0, 0, {
                'parent_line_id': line.id,
                'name': line_name,
                'temporal_type': 'subscription',
                'product_id': product.id,
                'product_uom': line.product_uom.id,
                'product_uom_qty': quantity,
                'price_unit': line.price_unit,
                'discount': discount,
                'start_date': line_start,
                'next_invoice_date': next_invoice_date,
                'pricing_id': line.pricing_id.id
            }))
        return order_lines

    def _reset_subscription_quantity_post_invoice(self):
        """ Update the Delivered/Invoiced value of subscription line according to the periods
        """
        self.filtered(lambda sol: sol.temporal_type == 'subscription' and sol.qty_delivered_method == 'manual' and sol.product_id.invoice_policy == 'delivery').write({'qty_delivered': 0})

    def _subscription_update_line_data(self, subscription):
        """
        Prepare a dictionary of values to add or update lines on a subscription.
        :return: order_line values to create or update the subscription
        """
        values = []
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
                else:
                    dict_changes.setdefault(sub_line.id, sub_line.product_uom_qty)
                    # upsell, we add the product to the existing quantity
                    dict_changes[sub_line.id] += line.product_uom_qty
            else:
                next_invoice_date = False
                # we create a new line in the subscription:
                if line.temporal_type == 'subscription':
                    start_date = line.start_date or fields.Datetime.today()
                else:
                    start_date = False
                    next_invoice_date = False
                values.append(Command.create({
                    'product_id': line.product_id.id,
                    'name': line.name,
                    'product_uom_qty': line.product_uom_qty,
                    'product_uom': line.product_uom.id,
                    'price_unit': line.price_unit,
                    'discount': line.discount,
                    'pricing_id': line.pricing_id.id,
                    'start_date': start_date,
                    'next_invoice_date': next_invoice_date,
                    'order_id': subscription.id
                }))

        values += [(1, sub_id, {'product_uom_qty': dict_changes[sub_id]}) for sub_id in dict_changes]
        return values

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
