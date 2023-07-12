# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _, _lt, Command
from odoo.tools import get_timedelta, float_compare, float_is_zero

billing_period_sentence_template = {
    'week': ('per week', 'per %s weeks'),
    'month': ('per month', 'per %s months'),
    'year': ('per year', 'per %s years'),
}

class SaleSubscriptionPlan(models.Model):
    _name = 'sale.subscription.plan'
    _description = 'Subscription Plan'

    active = fields.Boolean(default=True)
    name = fields.Char(translate=True, required=True, default="Monthly")
    company_id = fields.Many2one('res.company')

    # Billing Period, use billing_period property for access to the timedelta
    billing_period_value = fields.Integer(string="Duration", required=True, default=1,
                                          help="Minimum duration before this rule is applied. If set to 0, it represents a fixed temporal price.")
    billing_period_unit = fields.Selection([("week", "Weeks"), ("month", "Months"), ('year', 'Years')],
                                           string="Unit", required=True, default='month')

    billing_period_display = fields.Char(compute='_compute_billing_period_display', string="Billing Period")
    billing_period_display_sentence = fields.Char(compute='_compute_billing_period_display_sentence', string="Billing Period Display")

    # Self Service
    user_closable = fields.Boolean(string="Closable", default=False,
                                   help="Customer can close their subscriptions.")
    user_extend = fields.Boolean("Renew", default=False,
                                 help="Customer can create a renewal quotation for their subscription.")
    user_quantity = fields.Boolean("Add Products", default=False,
                                   help="Allow customers to create an Upsell quote to adjust the quantity of products in their subscription."
                                   "Only products that are listed as \"optional products\" can be modified.")
    related_plan_id = fields.Many2many("sale.subscription.plan", "sale_subscription_plan_related_plan",
                                       "plan_id", "related_plan_id", string="Optional Plans",
                                       help="Allow your customers to switch from this plan to "
                                            "another on quotation (new subscription or renewal)")

    # Invoicing
    auto_close_limit = fields.Integer(string="Automatic Closing", default=15,
                                      help="Unpaid subscription after the due date majored by this number of days will be automatically closed by "
                                      "the subscriptions expiration scheduled action. \n"
                                      "If the chosen payment method has failed to renew the subscription after this time, "
                                      "the subscription is automatically closed.")

    auto_close_limit_display = fields.Char(string="Automatic Closing After", compute="_compute_auto_close_limit_display")

    invoice_mail_template_id = fields.Many2one('mail.template', string='Invoice Email Template',
                                               domain=[('model', '=', 'account.move')],
                                               default=lambda self: self.env.ref('account.email_template_edi_invoice', raise_if_not_found=False),
                                               help="Email template used to send invoicing email automatically.\n"
                                                    "Leave it empty if you don't want to send email automatically.")

    product_subscription_pricing_ids = fields.One2many('sale.subscription.pricing', 'plan_id', string="Recurring Pricing",
                                                       domain=['|', ('product_template_id', '=', None), ('product_template_id.active', '=', True)])

    # UX
    active_subs_count = fields.Integer(compute="_compute_active_subs_count", string="Subscriptions")

    def write(self, values):
        if "related_plan_id" in values:
            old_related = {plan.id: plan.related_plan_id for plan in self}
        res = super().write(values)
        if "related_plan_id" in values:
            for plan in self:
                if to_remove := old_related[plan.id] - plan.related_plan_id:
                    to_remove.related_plan_id = [Command.unlink(plan.id)]
                if to_add :=  plan.related_plan_id - old_related[plan.id]:
                    to_add.related_plan_id = [Command.link(plan.id)]
        return res

    def _compute_active_subs_count(self):
        self.active_subs_count = 0
        res = self.env['sale.order'].read_group(
            [('plan_id', 'in', self.ids), ('is_subscription', '=', True), ('subscription_state', 'in', ['3_progress', '4_paused'])],
            ['__count'], ['plan_id'],
        )
        for template in res:
            if template['plan_id']:
                self.browse(template['plan_id'][0]).active_subs_count = template['plan_id_count']

    def action_open_active_sub(self):
        return {
            'name': _('Subscriptions'),
            'view_mode': 'tree,form',
            'domain': [('plan_id', 'in', self.ids), ('is_subscription', '=', True), ('subscription_state', 'in', ['3_progress', '4_paused'])],
            'res_model': 'sale.order',
            'type': 'ir.actions.act_window',
        }

    @property
    def billing_period(self):
        if not self.billing_period_unit or not self.billing_period_value:
            return False
        return get_timedelta(self.billing_period_value, self.billing_period_unit)

    @api.depends('billing_period_value', 'billing_period_unit')
    def _compute_billing_period_display(self):
        for plan in self:
            plan.billing_period_display = f"{plan.billing_period_value} {plan._get_unit_label()}"

    @api.depends('billing_period_value', 'billing_period_unit')
    def _compute_billing_period_display_sentence(self):
        for plan in self:
            sentence = billing_period_sentence_template.get(plan.billing_period_unit)[plan.billing_period_value > 1]
            plan.billing_period_display_sentence = _(sentence, plan.billing_period_value) if plan.billing_period_value > 1 else _(sentence)

    @api.depends('auto_close_limit')
    def _compute_auto_close_limit_display(self):
        for plan in self:
            plan.auto_close_limit_display = _lt('%s days', plan.auto_close_limit)

    def _get_unit_label(self):
        """ Get the translated product pricing unit label. """
        self.ensure_one()
        if not float_compare(self.billing_period_value, 1.0, precision_digits=2) \
                and not float_is_zero(self.billing_period_value, precision_digits=2):
            return _lt(self.billing_period_unit.capitalize())
        else:
            return _lt(dict(self._fields['billing_period_unit']._description_selection(self.env))[self.billing_period_unit])
