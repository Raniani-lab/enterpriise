# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class SaleOrderTemplate(models.Model):
    _name = "sale.order.template"
    _inherit = 'sale.order.template'

    is_subscription = fields.Boolean(compute='_compute_is_subscription', search='_search_is_subscription')
    recurring_rule_type = fields.Selection([('month', 'Months'), ('year', 'Years'), ], string='Recurrence', help="Contract duration", default='month')
    recurring_rule_boundary = fields.Selection([
        ('unlimited', 'Forever'),
        ('limited', 'Fixed')
    ], string='Duration', default='unlimited')
    recurring_rule_count = fields.Integer(string="End After", default=1)

    user_closable = fields.Boolean(string="Closable by Customer",
                                   help="If checked, the user will be able to close his account from the frontend")
    payment_mode = fields.Selection([
        ('manual', 'Manually'), ('draft_invoice', 'Draft'), ('validate_send', 'Post and Send'), ('success_payment', 'Send after successful payment'),
    ], default='draft_invoice')
    journal_id = fields.Many2one(
        'account.journal', string="Invoicing Journal",
        domain="[('type', '=', 'sale')]", company_dependent=True, check_company=True,
        help="If set, subscriptions with this template will invoice in this journal; "
             "otherwise the sales journal with the lowest sequence is used.")

    tag_ids = fields.Many2many(
        'account.analytic.tag', 'sale_order_template_tag_rel',
        'template_id', 'tag_id', string='Tags', help="Use these tags to filter your subscription reporting",
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]")
    color = fields.Integer()
    auto_close_limit = fields.Integer(
        string="Automatic Closing", default=15,
        help="If the chosen payment method has failed to renew the subscription after this time, "
             "the subscription is automatically closed.")
    good_health_domain = fields.Char(string='Good Health', default='[]',
                                     help="Domain used to change subscription's Kanban state with a 'Good' rating")
    bad_health_domain = fields.Char(string='Bad Health', default='[]',
                                    help="Domain used to change subscription's Kanban state with a 'Bad' rating")
    invoice_mail_template_id = fields.Many2one(
        'mail.template', string='Invoice Email Template', domain=[('model', '=', 'account.move')],
        default=lambda self: self.env.ref('sale_subscription.mail_template_subscription_invoice', raise_if_not_found=False))

    @api.constrains('recurring_rule_boundary', 'recurring_rule_type')
    def _check_template_duration(self):
        weight = {'day': 1, 'week': 10, 'month': 100, 'year': 1000}
        error_message = _("Make sure that the template duration is longer than the lines periodicity")
        for line in self.filtered(lambda t: t.recurring_rule_boundary == 'limited').sale_order_template_line_ids:
            if line.pricing_id.unit and line.sale_order_template_id.recurring_rule_type and \
                    weight[line.pricing_id.unit] > weight[line.sale_order_template_id.recurring_rule_type]:
                raise ValidationError(error_message)
            elif line.pricing_id.unit and line.sale_order_template_id.recurring_rule_type and \
                    weight[line.pricing_id.unit] == weight[line.sale_order_template_id.recurring_rule_type] and \
                    line.pricing_id.duration > line.sale_order_template_id.recurring_rule_count:
                raise ValidationError(error_message)

    @api.constrains('payment_mode')
    def _check_payment_mode(self):
        for template in self:
            if template.is_subscription and not template.payment_mode:
                raise ValidationError(_("The payment mode is mandatory on recurring templates"))

    @api.depends('sale_order_template_line_ids.product_id', 'sale_order_template_line_ids.pricing_id')
    def _compute_is_subscription(self):
        for template in self:
            recurring_product = template.sale_order_template_line_ids.mapped('recurring_invoice')
            pricing_id = template.sale_order_template_line_ids.pricing_id
            template.is_subscription = recurring_product and pricing_id

    @api.model
    def _search_is_subscription(self, operator, value):
        if operator not in ['=', '!='] or not isinstance(value, bool):
            raise NotImplementedError(_('Operation not supported'))
        recurring_templates = self.env['sale.order.template.line'].search([('recurring_invoice', '=', True), ('pricing_id', '!=', False)]).mapped('sale_order_template_id')
        if (operator == '=' and value) or (operator == '!=' and not value):
            # Look for subscription templates
            domain = [('id', 'in', recurring_templates.ids)]
        else:
            # Look for non subscription templates
            domain = [('id', 'not in', recurring_templates.ids)]
        return domain


class SaleOrderTemplateLine(models.Model):
    _name = "sale.order.template.line"
    _inherit = ['sale.order.template.line']

    product_pricing_ids = fields.One2many('product.pricing', compute='_compute_product_pricing_ids')
    pricing_id = fields.Many2one('product.pricing', domain="[('id', 'in', product_pricing_ids)]")
    recurring_invoice = fields.Boolean(related='product_id.recurring_invoice')

    @api.depends('product_id')
    def _compute_product_pricing_ids(self):
        available_pricings_ids = self.product_id.product_pricing_ids
        for line in self:
            product_pricing_ids = self.env['product.pricing']
            if line.product_id and line.product_id.product_pricing_ids:
                # We allow to display one type of pricing per periocitiy
                pricing_ids = available_pricings_ids.filtered(lambda p: p.product_template_id.id == line.product_id.product_tmpl_id.id)
                # We keep only one periodicity to avoid duplicate pricing for each pricelist
                product_pricing_ids |= pricing_ids._get_pricing_samples()
            line.product_pricing_ids = product_pricing_ids


class SaleOrderTemplateOption(models.Model):
    _name = "sale.order.template.option"
    _inherit = ['sale.order.template.option']

    product_pricing_ids = fields.One2many('product.pricing', compute='_compute_product_pricing_ids')
    option_pricing_id = fields.Many2one('product.pricing', domain="[('id', 'in', product_pricing_ids)]")
    recurring_invoice = fields.Boolean(related='product_id.recurring_invoice')

    @api.depends('product_id')
    def _compute_product_pricing_ids(self):
        """ copy pasted, it should be in a mixin or something """
        available_pricings_ids = self.product_id.product_pricing_ids
        for line in self:
            product_pricing_ids = self.env['product.pricing']
            if line.product_id and line.product_id.product_pricing_ids:
                # We allow to display one type of pricing per periocitiy
                pricing_ids = available_pricings_ids.filtered(
                    lambda p: p.product_template_id.id == line.product_id.product_tmpl_id.id)
                # We keep only one periodicity to avoid duplicate pricing for each pricelist
                product_pricing_ids |= pricing_ids._get_pricing_samples()
            line.product_pricing_ids = product_pricing_ids
