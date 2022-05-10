# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from dateutil.relativedelta import relativedelta
from psycopg2.extensions import TransactionRollbackError
from psycopg2 import sql
from ast import literal_eval

from odoo import fields, models, _, api, Command, SUPERUSER_ID
from odoo.exceptions import UserError, ValidationError
from odoo.tools.float_utils import float_is_zero
from odoo.tools import format_amount
from odoo.osv import expression
from odoo.tools import config
from odoo.tools.date_utils import get_timedelta

_logger = logging.getLogger(__name__)


class SaleOrder(models.Model):
    _name = "sale.order"
    _inherit = ["rating.mixin", "sale.order"]

    def _get_default_stage_id(self):
        return self.env['sale.order.stage'].search([], order='sequence', limit=1)

    def _get_default_starred_user_ids(self):
        return [(4, self.env.uid)]

    subscription_management = fields.Selection(
        string='Subscription Management',
        selection=[
            ('create', 'Creation'),
            ('renew', 'Renewal'),
            ('upsell', 'Upselling')],
        default='create',
        help="Creation: The Sales Order created the subscription\n"
             "Upselling: The Sales Order added lines to the subscription\n"
             "Renewal: The Sales Order replaced the subscription's content with its own")
    is_subscription = fields.Boolean("Recurring", compute='_compute_is_subscription', store=True, index=True)
    stage_id = fields.Many2one('sale.order.stage', string='Stage', index=True, default=lambda s: s._get_default_stage_id(),
                               copy=False, group_expand='_read_group_stage_ids', tracking=True)
    account_tag_ids = fields.Many2many('account.analytic.tag', 'account_analytic_tag_sale_order_rel',
                                       'sale_order_id', 'account_analytic_tag_sale_order_rel', string='Account Tags',
                                       domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]", check_company=True)
    end_date = fields.Date(string='End Date', tracking=True,
                           help="If set in advance, the subscription will be set to renew 1 month before the date and will be closed on the date set in this field.")
    archived_product_ids = fields.Many2many('product.product', string='Archived Products', compute='_compute_archived')
    archived_product_count = fields.Integer("Archived Product", compute='_compute_archived')
    next_invoice_date = fields.Date(string='Date of Next Invoice', compute='_compute_next_invoice_date', search='_search_next_invoice_date',
                                    help="The next invoice will be created on this date then the period will be extended.")
    start_date = fields.Date(string='Start Date', compute='_compute_start_date', search='_search_start_date',
                             help="The subscription starts when at least one of its line starts.")
    recurring_live = fields.Boolean(string='Alive', compute='_compute_recurring_live', store=True)
    recurring_monthly = fields.Monetary(compute='_compute_recurring_monthly', string="Monthly Recurring Revenue",
                                        store=True, tracking=True)
    close_reason_id = fields.Many2one("sale.order.close.reason", string="Close Reason", copy=False, tracking=True)
    order_log_ids = fields.One2many('sale.order.log', 'order_id', string='Subscription Logs', readonly=True)
    payment_mode = fields.Selection(related='sale_order_template_id.payment_mode')
    team_user_id = fields.Many2one('res.users', string="Team Leader", related="team_id.user_id", readonly=False)
    country_id = fields.Many2one('res.country', related='partner_id.country_id', store=True, compute_sudo=True)
    industry_id = fields.Many2one('res.partner.industry', related='partner_id.industry_id', store=True)
    commercial_partner_id = fields.Many2one('res.partner', related='partner_id.commercial_partner_id')
    payment_token_id = fields.Many2one('payment.token', 'Payment Token', check_company=True, help='If not set, the automatic payment will fail.',
                                       domain="[('partner_id', 'child_of', commercial_partner_id), ('company_id', '=', company_id)]")
    recurring_rule_boundary = fields.Selection([('unlimited', 'Forever'), ('limited', 'Fixed')], compute='_compute_recurring_rule_boundary', readonly=False)
    starred_user_ids = fields.Many2many('res.users', 'sale_order_starred_user_rel', 'order_id', 'user_id',
                                        default=lambda s: s._get_default_starred_user_ids(), string='Members')
    starred = fields.Boolean(compute='_compute_starred', inverse='_inverse_starred', string='Show Subscription on dashboard',
                             help="Whether this subscription should be displayed on the dashboard or not")
    kpi_1month_mrr_delta = fields.Float('KPI 1 Month MRR Delta')
    kpi_1month_mrr_percentage = fields.Float('KPI 1 Month MRR Percentage')
    kpi_3months_mrr_delta = fields.Float('KPI 3 months MRR Delta')
    kpi_3months_mrr_percentage = fields.Float('KPI 3 Months MRR Percentage')
    percentage_satisfaction = fields.Integer(
        compute="_compute_percentage_satisfaction",
        string="% Happy", store=True, compute_sudo=True, default=-1,
        help="Calculate the ratio between the number of the best ('great') ratings and the total number of ratings")
    health = fields.Selection([('normal', 'Neutral'), ('done', 'Good'), ('bad', 'Bad')], string="Health", copy=False, default='normal', help="Show the health status")
    stage_category = fields.Selection(related='stage_id.category', store=True)
    to_renew = fields.Boolean(string='To Renew', default=False, copy=False)

    subscription_id = fields.Many2one('sale.order', string='Parent Contract', ondelete='restrict', copy=False)
    origin_order_id = fields.Many2one('sale.order', string='First contract', ondelete='restrict', copy=False, store=True, compute='_compute_origin_order_id')
    subscription_child_ids = fields.One2many('sale.order', 'subscription_id')
    history_count = fields.Integer(compute='_compute_history_count')
    recurring_pricing_details = fields.Html(compute='_compute_recurring_pricing_details')
    payment_exception = fields.Boolean("Contract in exception", tracking=True,
                                       help="Automatic payment with token failed. The payment acquirer configuration and token should be checked")

    _sql_constraints = [
        ('sale_subscription_stage_coherence',
         "CHECK(NOT (is_subscription=TRUE AND state IN ('sale', 'done') AND stage_category='draft'))",
         "You cannot set to draft a confirmed subscription. Please create a new quotation"),
    ]

    @api.depends('order_line.temporal_type', 'order_line.pricing_id')
    def _compute_is_subscription(self):
        for order in self:
            subscription_lines = order.order_line.filtered(lambda l: l.temporal_type == 'subscription' and l.pricing_id)
            if not subscription_lines or order.subscription_management == 'upsell':
                order.is_subscription = False
            else:
                order.is_subscription = True

    @api.depends('subscription_management', 'subscription_id')
    def _compute_partner_invoice_id(self):
        super()._compute_partner_invoice_id()
        for order in self:
            if not order.subscription_management or not order.subscription_id:
                continue
            order.partner_invoice_id = order.subscription_id.partner_invoice_id

    @api.depends('subscription_management', 'subscription_id')
    def _compute_partner_shipping_id(self):
        super()._compute_partner_shipping_id()
        for order in self:
            if not order.subscription_management or not order.subscription_id:
                continue
            order.partner_shipping_id = order.subscription_id.partner_shipping_id

    @api.depends('rating_percentage_satisfaction')
    def _compute_percentage_satisfaction(self):
        for subscription in self:
            subscription.percentage_satisfaction = int(subscription.rating_percentage_satisfaction)

    @api.depends('starred_user_ids')
    @api.depends_context('uid')
    def _compute_starred(self):
        for subscription in self:
            subscription.starred = self.env.user in subscription.starred_user_ids

    def _inverse_starred(self):
        starred_subscriptions = not_star_subscriptions = self.env['sale.order'].sudo()
        for subscription in self:
            if self.env.user in subscription.starred_user_ids:
                starred_subscriptions |= subscription
            else:
                not_star_subscriptions |= subscription
        not_star_subscriptions.write({'starred_user_ids': [(4, self.env.uid)]})
        starred_subscriptions.write({'starred_user_ids': [(3, self.env.uid)]})

    @api.depends(
        'order_line.recurring_monthly', 'stage_category', 'state', 'is_subscription',
        'order_line.next_invoice_date', 'order_line.start_date', 'invoice_ids')
    def _compute_recurring_monthly(self):
        """ Compute the amount monthly recurring revenue. When a subscription has a parent still ongoing.
        Depending on invoice_ids force the recurring monthly to be recomputed regularly, even for the first invoice
        where confirmation is set the next_invoice_date and first invoice do not update it (in automatic mode).
        """
        today = fields.Datetime.today()
        for order in self:
            if not order.is_subscription or order.stage_category != 'progress' or \
                    order.state not in ['sale', 'done'] or not order.start_date or order.start_date > today.date():
                order.recurring_monthly = 0.0
                continue
            order_lines = order.order_line.filtered(
                lambda l: l.start_date and l.next_invoice_date and l.start_date <= today <= l.next_invoice_date)
            order.recurring_monthly = sum(order_lines.mapped('recurring_monthly'))

    def _compute_recurring_rule_boundary(self):
        for order in self:
            if not order.is_subscription:
                order.recurring_rule_boundary = False
            elif not order.sale_order_template_id:
                order.recurring_rule_boundary = 'unlimited'
            else:
                order.recurring_rule_boundary = order.sale_order_template_id.recurring_rule_boundary

    def _compute_access_url(self):
        super()._compute_access_url()
        for order in self:
            # Quotations are handled in the quotation menu
            if order.is_subscription and order.stage_category in ['progress', 'closed']:
                order.access_url = '/my/subscription/%s' % order.id

    @api.depends('order_line.product_id', 'order_line.product_id.active')
    def _compute_archived(self):
        # Search which products are archived when reading the subscriptions lines
        archived_product_ids = self.env['product.product'].search(
            [('id', 'in', self.order_line.product_id.ids), ('recurring_invoice', '=', True),
             ('active', '=', False)])
        for order in self:
            products = archived_product_ids.filtered(lambda p: p.id in order.order_line.product_id.ids)
            order.archived_product_ids = [(6, 0, products.ids)]
            order.archived_product_count = len(products)

    @api.depends('order_line.start_date')
    def _compute_start_date(self):
        for so in self:
            if not so.is_subscription:
                so.start_date = False
            elif so.order_line:
                start_dates = [sd for sd in so.order_line.mapped('start_date') if sd]
                so.start_date = start_dates and min(start_dates)
            else:
                so.start_date = False

    @api.depends('order_line.start_date', 'subscription_child_ids', 'recurring_monthly')
    def _compute_recurring_live(self):
        """ The live state allows to select the latest running subscription of a family
            It is helpful to see on which record next activities should be saved, count the real number of live contracts etc
        """
        for order in self:
            if not order.is_subscription:
                order.recurring_live = False
                continue
            cur_round = order.company_id.currency_id.rounding
            if not float_is_zero(order.recurring_monthly, precision_rounding=cur_round) and \
                    (not order.subscription_child_ids or not any(order.subscription_child_ids.mapped('recurring_monthly'))):
                order.recurring_live = True
            else:
                order.recurring_live = False

    @api.model
    def _get_computed_date_search_orders(self, field, operator, value):
        if not value or operator not in ['<', '<=', '>', '>=', '=']:
            raise NotImplementedError(_('This operator is not supported'))
        else:
            query = """
                       SELECT order_id,MIN({field_name}) field_date
                         FROM sale_order_line sol
                         JOIN product_product pp ON pp.id=sol.product_id
                         JOIN product_template pt ON pt.id=pp.product_tmpl_id
                        WHERE pt.recurring_invoice IS true
                          AND sol.{field_name} {operator} {value}
                     GROUP BY order_id
                """
            self.env.cr.execute(
                sql.SQL(query).format(
                    field_name=sql.Identifier(field),
                    operator=sql.SQL(operator),
                    value=sql.Literal(value),
                )
            )
            return self.env.cr.dictfetchall()

    @api.model
    def _search_start_date(self, operator, value):
        result = self._get_computed_date_search_orders('start_date', operator, value)
        sale_order_ids = [res['order_id'] for res in result]
        return [('id', 'in', sale_order_ids)]

    @api.depends('order_line.next_invoice_date')
    def _compute_next_invoice_date(self):
        subscriptions = self.filtered('is_subscription')
        (self - subscriptions).next_invoice_date = False
        for so in self:
            if so.order_line:
                invoice_dates = [nid for nid in so.order_line.mapped('next_invoice_date') if nid]
                so.next_invoice_date = invoice_dates and min(invoice_dates)
            else:
                so.next_invoice_date = False

    @api.model
    def _search_next_invoice_date(self, operator, value):
        result = self._get_computed_date_search_orders('next_invoice_date', operator, value)
        sale_order_ids = [res['order_id'] for res in result]
        return [('id', 'in', sale_order_ids)]

    @api.depends('origin_order_id')
    def _compute_history_count(self):
        if not self.origin_order_id:
            self.history_count = 0
            return
        result = self.env['sale.order'].read_group([
                ('state', '!=', 'cancel'),
                ('origin_order_id', 'in', self.origin_order_id.ids)
            ],
            ['origin_order_id'],
            ['origin_order_id']
        )
        counters = {data['origin_order_id'][0]: data['origin_order_id_count'] for data in result}
        for so in self:
            so.history_count = counters.get(so.origin_order_id.id, 0)

    @api.depends('is_subscription', 'subscription_management')
    def _compute_origin_order_id(self):
        for order in self:
            if (order.is_subscription or order.subscription_management == 'upsell') and not order.origin_order_id:
                order.origin_order_id = order.subscription_id or order.id

    @api.depends('order_line.pricing_id', 'order_line.price_total')
    def _compute_recurring_pricing_details(self):
        subscription_orders = self.filtered(lambda sub: sub.is_subscription or sub.subscription_id)
        self.recurring_pricing_details = ""
        if subscription_orders.ids:
            query = """
                SELECT order_id, SUM(price_subtotal) as untaxed,SUM(price_total) as total,pp.duration AS duration,pp.unit AS unit
                  FROM sale_order_line sol 
                  JOIN product_pricing pp ON pp.id=sol.pricing_id
                 WHERE order_id in %s
                   AND sol.pricing_id IS NOT NULL
                   AND pp.duration > 0
              GROUP BY order_id,duration,unit
              ORDER BY duration,unit
            """
            self.env.cr.execute(query, (tuple(subscription_orders.ids),))
            pricing_details = self.env.cr.dictfetchall()
            for so in subscription_orders:
                lang_code = so.partner_id.lang
                pricing_values = [details for details in pricing_details if details['order_id'] == so.id and details['untaxed'] and details['total']]
                rendering_values = []
                for plan in pricing_values:
                    untaxed_amount = so.currency_id and format_amount(self.env, plan['untaxed'], so.currency_id, lang_code) or plan['untaxed']
                    total_amount = so.currency_id and format_amount(self.env, plan['total'], so.currency_id, lang_code) or plan['total']
                    rendering_values.append({'untaxed_amount': untaxed_amount, 'total_amount': total_amount,
                                             'periodicity': int(plan['duration']), 'unit': plan['unit']
                                             })
                so.recurring_pricing_details = self.env['ir.qweb']._render('sale_subscription.pricing_details', {'rendering_values': rendering_values})

    @api.model
    def _read_group_stage_ids(self, stages, domain, order):
        return stages.sudo().search([], order=order)

    def _track_subtype(self, init_values):
        self.ensure_one()
        if 'stage_id' in init_values:
            return self.env.ref('sale_subscription.subtype_stage_change')
        return super()._track_subtype(init_values)

    @api.onchange('sale_order_template_id')
    def _onchange_sale_order_template_id(self):
        # Override to propagate the account tags on the subscription and update the prices according to periodicity
        super()._onchange_sale_order_template_id()
        template = self.sale_order_template_id
        if template.tag_ids.ids:
            self.account_tag_ids = [Command.link(tag_id) for tag_id in template.tag_ids.ids]

    def _create_mrr_log(self, template_value, initial_values):
        alive_renewals = self.filtered(lambda sub: sub.subscription_id and sub.subscription_management == 'renew' and sub.stage_category == 'progress')
        alive_child_categories = self.subscription_child_ids.mapped('stage_category')
        is_transfered_parent = any([stage == 'progress' for stage in alive_child_categories])
        cur_round = self.company_id.currency_id.rounding
        old_mrr = initial_values['recurring_monthly']
        transfer_mrr = 0
        mrr_difference = self.recurring_monthly - old_mrr
        today = fields.Datetime.today()
        start_threshold = today - relativedelta(days=15) # we only account for the transfer parent for 15 days old new line at most to avoid counting the same lines multiple times
        if self.id in alive_renewals.ids:
            for line in self.order_line:
                if line.parent_line_id and start_threshold <= line.start_date <= today:
                    transfer_mrr += line.recurring_monthly - line.parent_line_id.recurring_monthly
        if transfer_mrr:
            transfer_values = template_value.copy()
            amount_signed = transfer_mrr
            recurring_monthly = self.recurring_monthly - transfer_mrr
            if not float_is_zero(amount_signed, precision_rounding=cur_round):
                transfer_values.update({'event_type': '3_transfer', 'amount_signed': amount_signed,
                                        'recurring_monthly': recurring_monthly})
                self.env['sale.order.log'].sudo().create(transfer_values)

        if not float_is_zero(mrr_difference, precision_rounding=cur_round):
            mrr_value = template_value.copy()
            event_type = '1_change' if self.order_log_ids else '0_creation'
            if is_transfered_parent:
                event_type = '3_transfer'
            amount_signed = mrr_difference - transfer_mrr
            mrr_value.update({'event_type': event_type, 'amount_signed': amount_signed, 'recurring_monthly': self.recurring_monthly})
            self.env['sale.order.log'].sudo().create(mrr_value)

    def _create_stage_log(self, values, initial_values):
        old_stage_id = initial_values['stage_id']
        new_stage_id = self.stage_id
        log = None
        mrr_change_value = {}
        is_alive_renewal = self.subscription_id and self.subscription_management == 'renew' and self.stage_category == 'progress'
        alive_renewed = self.subscription_child_ids.filtered(
            lambda s: s.subscription_management == 'renew' and s.stage_category == 'progress' and s.recurring_monthly)
        if is_alive_renewal and self.subscription_id.stage_category == 'closed' and self.subscription_id.recurring_monthly == 0:
            # when the parent subscription is done, we don't register events as transfer anymore.
            is_alive_renewal = False
        if new_stage_id.category in ['progress', 'closed'] and old_stage_id.category != new_stage_id.category:
            # subscription started, churned or transferred to renew
            if new_stage_id.category == 'progress':
                if is_alive_renewal:
                    # Transfer for the renewed value and MRR change for the rest
                    parent_mrr = self.subscription_id.recurring_monthly
                    # Creation of renewal: transfer and MRR change
                    event_type = '3_transfer'
                    amount_signed = parent_mrr
                    recurring_monthly = parent_mrr
                    if self.recurring_monthly - parent_mrr != 0:
                        mrr_change_value = values.copy()
                        mrr_change_value.update({'event_type': '1_change', 'recurring_monthly': self.recurring_monthly,
                                                 'amount_signed': self.recurring_monthly - parent_mrr})
                else:
                    event_type = '0_creation'
                    amount_signed = self.recurring_monthly
                    recurring_monthly = self.recurring_monthly
            else:
                event_type = '3_transfer' if alive_renewed else '2_churn'
                amount_signed = - initial_values['recurring_monthly']
                recurring_monthly = 0

            if is_alive_renewal and (not self.recurring_monthly or self.start_date > fields.Date.today()):
                # We don't create logs for confirmed renewal that start in the future
                return
            values.update(
                {'event_type': event_type, 'amount_signed': recurring_monthly, 'recurring_monthly': amount_signed})
            # prevent duplicate logs
            if not self.order_log_ids.filtered(
                lambda ev: ev.event_type == values['event_type'] and ev.event_date == values['event_date']):
                log = self.env['sale.order.log'].sudo().create(values)
            if mrr_change_value and not self.order_log_ids.filtered(
                lambda ev: ev.event_type == mrr_change_value['event_type'] and ev.event_date == mrr_change_value['event_date']):
                log = self.env['sale.order.log'].sudo().create(mrr_change_value)
        return log

    def _mail_track(self, tracked_fields, initial_values):
        """ For a given record, fields to check (tuple column name, column info)
                and initial values, return a structure that is a tuple containing :
                 - a set of updated column names
                 - a list of ORM (0, 0, values) commands to create 'mail.tracking.value' """
        res = super()._mail_track(tracked_fields, initial_values)
        if not self.is_subscription:
            return res
        updated_fields, dummy = res
        values = {'event_date': fields.Date.context_today(self), 'order_id': self.id,
                  'currency_id': self.currency_id.id,
                  'category': self.stage_id.category, 'user_id': self.user_id.id,
                  'team_id': self.team_id.id, }
        stage_log = None
        if 'stage_id' in initial_values:
            stage_log = self._create_stage_log(values, initial_values)
        if 'recurring_monthly' in updated_fields and not stage_log:
            self._create_mrr_log(values, initial_values)
        return res

    ###########
    # CRUD    #
    ###########

    @api.model_create_multi
    def create(self, vals_list):
        orders = super().create(vals_list)
        for order, vals in zip(orders, vals_list):
            if not order.is_subscription:
                continue
            if vals.get('stage_id'):
                order._send_subscription_rating_mail(force_send=True)
        return orders

    def write(self, vals):
        subscriptions = self.filtered('is_subscription')
        old_partners = {s.id: s.partner_id.id for s in subscriptions}
        old_in_progress = {s.id: s.stage_category == "progress" for s in subscriptions}
        if vals.get('payment_token_id'):
            # check access rule for token to make sure the user is allowed to read it. This prevents
            # assigning unowned tokens through RPC calls
            self.env['payment.token'].browse(vals.get('payment_token_id')).check_access_rule('read')
        res = super().write(vals)
        if vals.get('stage_id'):
            subscriptions._send_subscription_rating_mail(force_send=True)
        if vals.get('company_id'):
            # simple SO don't see their lines recomputed, especially when they are in a sent/confirmed state.
            # Subscription should be updated
            subscriptions.order_line._compute_tax_id()
        subscriptions_to_confirm = self.env['sale.order']
        subscriptions_to_cancel = self.env['sale.order']
        for subscription in subscriptions:
            diff_partner = subscription.partner_id.id != old_partners[subscription.id]
            diff_in_progress = (subscription.stage_category == "progress") != old_in_progress[subscription.id]
            if diff_partner or diff_in_progress:
                if subscription.stage_category == "progress" and diff_partner:
                    subscription.message_subscribe(subscription.partner_id.ids)
                    subscriptions_to_confirm += subscription
                if subscription.stage_category == "closed" and not subscription.state == 'done':
                    subscriptions_to_cancel += subscription
                if diff_partner or subscription.stage_category != "progress":
                    subscription.message_unsubscribe([old_partners[subscription.id]])
        if subscriptions_to_confirm:
            subscriptions_to_confirm.action_confirm()
        if subscriptions_to_cancel:
            subscriptions_to_cancel.action_cancel()
        return res

    ###########
    # Actions #
    ###########

    def action_archived_product(self):
        archived_template_ids = self.with_context(active_test=False).archived_product_ids.product_tmpl_id
        action = self.env["ir.actions.actions"]._for_xml_id("sale_subscription.product_action_subscription")
        action['domain'] = [('id', 'in', archived_template_ids.ids), ('active', '=', False)]
        action['context'] = dict(literal_eval(action.get('context')), search_default_inactive=True)
        return action

    def action_draft(self):
        if any(order.state == 'cancel' and order.is_subscription for order in self):
            raise UserError(
                _('You cannot set to draft a canceled quotation linked to subscriptions. Please create a new quotation.'))
        return super(SaleOrder, self).action_draft()

    def _action_cancel(self):
        self._set_closed_state()
        return super()._action_cancel()

    def _prepare_confirmation_values(self):
        """
        Override of the sale method. sale.order in self should have the same stage_id in order to process
        them in batch.
        :return: dict of values
        """
        values = {
            'state': 'sale',
            'date_order': fields.Datetime.now()
        }
        is_subscription = all(self.mapped('is_subscription'))
        if is_subscription:
            stages_in_progress = self.env['sale.order.stage'].search([('category', '=', 'progress')])
            if not stages_in_progress:
                raise ValidationError(_("Unable to put the subscription in a progress stage"))
            next_stage_in_progress = stages_in_progress.filtered(lambda s: s.sequence > self.stage_id.sequence)[:1]
            if not next_stage_in_progress:
                next_stage_in_progress = stages_in_progress.filtered(lambda s: s.id == max(stages_in_progress.ids))
            values.update({'stage_id': next_stage_in_progress, 'stage_category': next_stage_in_progress.category})
        return values

    def action_confirm(self):
        """Update and/or create subscriptions on order confirmation."""
        confirmed_subscription = self.filtered('is_subscription')
        # We need to call super with batches of subscription in the same stage
        res = super(SaleOrder, self - confirmed_subscription).action_confirm()
        for stage in confirmed_subscription.mapped('stage_id'):
            subs_current_stage = confirmed_subscription.filtered(lambda so: so.stage_id.id == stage.id)
            res = res and super(SaleOrder, subs_current_stage).action_confirm()
        child_subscriptions = self.filtered('subscription_id')
        renew = child_subscriptions.filtered(lambda s: s.subscription_management == 'renew')
        upsell = child_subscriptions.filtered(lambda s: s.subscription_management == 'upsell')
        confirmed_subscription._confirm_subscription()
        # renew have already the right invoice dates
        (confirmed_subscription - renew).order_line.filtered(lambda l: not l.next_invoice_date)._update_next_invoice_date(force=True)
        upsell._confirm_upsell()
        renew._confirm_renew()
        return res

    def _confirm_subscription(self):
        today = fields.Date.today()
        for sub in self:
            sub._portal_ensure_token()
            end_date = sub.end_date
            if sub.sale_order_template_id.recurring_rule_boundary == 'limited' and not sub.end_date:
                end_date = today + get_timedelta(sub.sale_order_template_id.recurring_rule_count, sub.sale_order_template_id.recurring_rule_type) - relativedelta(days=1)
            sub.write({'end_date': end_date})
            # We set the start date and invoice date at the date of confirmation to allow computing 'next_invoice_date'
            sub.order_line.filtered(lambda l: not l.start_date).write({'start_date': today})

    def _confirm_upsell(self):
        """
        When confirming an upsell order, the recurring product lines must be updated
        """
        today = fields.Date.today()
        future_lines = self.order_line.filtered(lambda l: l.start_date and l.start_date.date() > today)
        self.order_line.filtered(lambda l: not l.start_date and not l.display_type).write({'start_date': today})
        (self.order_line - future_lines)._update_next_invoice_date(force=True)
        self.update_existing_subscriptions()

    def _confirm_renew(self):
        """
        When confirming an upsell order, the recurring product lines must be updated
        """
        today = fields.Date.today()
        self.subscription_id.write({'to_renew': False})
        for renew in self:
            # When parent subscription reaches his end_date, it will be closed with a close_reason_renew so it won't be considered as a simple churn.
            parent = renew.subscription_id
            renew_msg_body = _(
                "This subscription is renewed in %s with a change of plan.", renew._get_html_link()
            )
            parent.message_post(body=renew_msg_body)
            parent.state = 'done'
            next_invoice_dates = [nid for nid in parent.order_line.mapped('next_invoice_date') if nid]
            if next_invoice_dates:
                parent.end_date = max(next_invoice_dates)
            start_date = parent.end_date or today
            renew.write({'date_order': start_date})

    def action_invoice_subscription(self):
        account_move = self._create_recurring_invoice()
        if account_move:
            action = self.env.ref('sale.action_invoice_salesteams')
            action['domain'] = [('id', 'in', account_move.ids)]
            return action
        else:
            raise UserError(self._nothing_to_invoice_error_message())

    @api.model
    def _get_associated_so_action(self):
        return {
            "type": "ir.actions.act_window",
            "res_model": "sale.order",
            "views": [[self.env.ref('sale_subscription.sale_order_view_tree_subscription').id, "tree"],
                      [self.env.ref('sale_subscription.sale_subscription_primary_form_view').id, "form"],
                      [False, "kanban"], [False, "calendar"], [False, "pivot"], [False, "graph"]],
            "context": {"create": False},
        }

    def open_subscription_history(self):
        self.ensure_one()
        action = self._get_associated_so_action()
        genealogy_orders_ids = self.search([('origin_order_id', 'in', self.origin_order_id.ids)])
        action['name'] = "History"
        action['domain'] = [('id', 'in', genealogy_orders_ids.ids)]
        return action

    def action_open_subscriptions(self):
        """ Display the linked subscription and adapt the view to the number of records to display."""
        self.ensure_one()
        subscriptions = self.order_line.mapped('subscription_id')
        action = self.env["ir.actions.actions"]._for_xml_id("sale_subscription.sale_subscription_action")
        if len(subscriptions) > 1:
            action['domain'] = [('id', 'in', subscriptions.ids)]
        elif len(subscriptions) == 1:
            form_view = [(self.env.ref('sale_subscription.sale_subscription_view_form').id, 'form')]
            if 'views' in action:
                action['views'] = form_view + [(state, view) for state, view in action['views'] if view != 'form']
            else:
                action['views'] = form_view
            action['res_id'] = subscriptions.ids[0]
        else:
            action = {'type': 'ir.actions.act_window_close'}
        action['context'] = dict(self._context, create=False)
        return action

    def action_sale_order_log(self):
        action = self.env["ir.actions.actions"]._for_xml_id("sale_subscription.action_sale_order_log")
        genealogy_orders_ids = self.search([('origin_order_id', 'in', self.origin_order_id.ids)])
        action.update({
            'name': _('MRR changes'),
            'domain': [('order_id', 'in', genealogy_orders_ids.ids), ('event_type', '!=', '3_transfer')],
        })
        return action

    def action_sale_order_lines(self):
        action = self.env["ir.actions.actions"]._for_xml_id("sale_subscription.action_sale_order_lines")
        genealogy_orders_ids = self.search([('origin_order_id', 'in', self.origin_order_id.ids)])
        action.update({
            'name': _('Sale Order Lines'),
            'domain': [('order_id', 'in', genealogy_orders_ids.ids)],
        })
        return action

    def _prepare_renew_upsell_order(self, subscription_management, message_body):
        self.ensure_one()
        values = self._prepare_upsell_renew_order_values(subscription_management)
        order = self.env['sale.order'].create(values)
        self.subscription_child_ids = [Command.link(order.id)]
        order.message_post(body=message_body)
        order.order_line._compute_tax_id()
        action = self._get_associated_so_action()
        action['name'] = _('Upsell') if subscription_management == 'upsell' else _('Renew')
        action['views'] = [(self.env.ref('sale_subscription.sale_subscription_primary_form_view').id, 'form')]
        action['res_id'] = order.id
        return action

    def prepare_renewal_order(self):
        self.ensure_one()
        renew_msg_body = _(
            "This subscription is the renewal of subscription %s.", self._get_html_link()
        )
        action = self._prepare_renew_upsell_order('renew', renew_msg_body)

        return action

    def prepare_upsell_order(self):
        self.ensure_one()
        upsell_msg_body = _("This upsell order has been created from the subscription %s.", self._get_html_link())
        action = self._prepare_renew_upsell_order('upsell', upsell_msg_body)
        return action

    ####################
    # Business Methods #
    ####################

    def update_existing_subscriptions(self, ):
        """
        Update subscriptions already linked to the order by updating or creating lines.

        :rtype: list(integer)
        :return: ids of modified subscriptions
        """
        res = self.subscription_id.ids
        subscriptions = self.mapped('subscription_id')
        for order in self:
            if order.subscription_id and order.subscription_management != 'renew':
                order.subscription_management = 'upsell'
            if order.subscription_management == 'renew':
                # remove existing lines, the renewal lines completely replace the old values
                order.subscription_id.mapped('order_line').unlink()
                subscriptions.payment_term_id = order.payment_term_id
                subscriptions.set_open()
            # We don't propagate the line description from the upsell order to the subscription
            line_values = order.order_line.filtered(lambda sol: not sol.display_type)._subscription_update_line_data(order.subscription_id)
            order.subscription_id.write({'order_line': line_values})
        return res

    def _subscription_update_line_data(self, subscription):
        """Prepare a dictionnary of values to add or update lines on a subscription."""
        values = list()
        dict_changes = dict()
        for line in self:
            sub_line = subscription.recurring_invoice_line_ids.filtered(
                lambda l: (l.product_id, l.uom_id, l.price_unit) == (line.product_id, line.product_uom, line.price_unit)
            )
            if sub_line:
                # We have already a subscription line, we need to modify the product quantity
                if len(sub_line) > 1:
                    # we are in an ambiguous case. To avoid adding information to a random line, in that case we create a new line
                    # we can simply duplicate an arbitrary line to that effect
                    sub_line[0].copy({'name': line.display_name, 'quantity': line.product_uom_qty})
                else:
                    dict_changes.setdefault(sub_line.id, sub_line.quantity)
                    # upsell, we add the product to the existing quantity
                    dict_changes[sub_line.id] += line.product_uom_qty
            else:
                # we create a new line in the subscription:
                values.append(line._prepare_subscription_line_data()[0])
        values += [(1, sub_id, {'quantity': dict_changes[sub_id]}) for sub_id in dict_changes]
        return values

    def _set_closed_state(self):
        stages_closed = self.env['sale.order.stage'].search([('category', '=', 'closed')])
        closed_orders = self.filtered('is_subscription')
        if not stages_closed and closed_orders:
            ValidationError(_("Error: unable to put the subscription in a closed stage"))
        for order in closed_orders:
            next_closed_stage = stages_closed.filtered(lambda s: s.sequence > order.stage_id.sequence)[:1]
            if not next_closed_stage:
                next_closed_stage = stages_closed.filtered(lambda s: s.id == max(stages_closed.ids))
            order.write({'stage_id': next_closed_stage.id, 'to_renew': False})

    def set_close(self):
        today = fields.Date.context_today(self)
        renew_close_reason_id = self.env.ref('sale_subscription.close_reason_renew').id
        self._set_closed_state()
        for sub in self:
            values = {}
            if sub.recurring_rule_boundary == 'unlimited' or not sub.end_date or today < sub.end_date:
                values['end_date'] = today
            renew = sub.subscription_child_ids.filtered(
                lambda so: so.subscription_management == 'renew' and so.state in ['sale', 'done'] and so.date_order and so.date_order.date() >= sub.end_date)
            if renew:
                # The subscription has been renewed. We set a close_reason to avoid consider it as a simple churn.
                values['close_reason_id'] = renew_close_reason_id
            sub.write(values)
        return True

    def set_to_renew(self):
        return self.write({'to_renew': True})

    def set_open(self):
        search = self.env['sale.order.stage'].search
        for sub in self:
            stage = search([('category', '=', 'progress'), ('sequence', '>=', sub.stage_id.sequence)], limit=1)
            if not stage:
                stage = search([('category', '=', 'progress')], limit=1)
            date = sub.end_date if sub.end_date and sub.sale_order_template_id.recurring_rule_boundary == 'limited' else False
            sub.write({'stage_id': stage.id, 'to_renew': False, 'end_date': date})

    @api.model
    def _cron_update_kpi(self):
        subscriptions = self.search([('stage_category', '=', 'progress'), ('is_subscription', '=', True)])
        subscriptions._compute_kpi()

    def _prepare_upsell_renew_order_values(self, subscription_management):
        """
        Create a new draft order with the same lines as the parent subscription. All recurring lines are linked to their parent lines
        :return: dict of new sale order values
        """
        self.ensure_one()
        subscription = self.with_company(self.company_id)
        order_lines = self.order_line._get_renew_upsell_values(subscription_management)
        is_subscription = subscription_management == 'renew'
        option_lines_data = [fields.Command.clear()]
        option_lines_data += [
            fields.Command.create(
                self._compute_option_data_for_template_change(option)
            )
            for option in self.sale_order_template_id.sale_order_template_option_ids
        ]
        return {
            'is_subscription': is_subscription,
            'subscription_id': subscription.id,
            'pricelist_id': subscription.pricelist_id.id,
            'partner_id': subscription.partner_id.id,
            'order_line': order_lines,
            'analytic_account_id': subscription.analytic_account_id.id,
            'subscription_management': subscription_management,
            'origin': subscription.client_order_ref,
            'client_order_ref': subscription.client_order_ref,
            'origin_order_id': subscription.origin_order_id.id,
            'note': subscription.note,
            'user_id': subscription.user_id.id,
            'payment_term_id': subscription.payment_term_id.id,
            'company_id': subscription.company_id.id,
            'sale_order_template_id': self.sale_order_template_id.id,
            'sale_order_option_ids': option_lines_data,
        }

    def _compute_kpi(self):
        for subscription in self:
            delta_1month = subscription._get_subscription_delta(fields.Date.today() - relativedelta(months=1))
            delta_3months = subscription._get_subscription_delta(fields.Date.today() - relativedelta(months=3))
            health = subscription._get_subscription_health()
            subscription.write({'kpi_1month_mrr_delta': delta_1month['delta'], 'kpi_1month_mrr_percentage': delta_1month['percentage'],
                                'kpi_3months_mrr_delta': delta_3months['delta'], 'kpi_3months_mrr_percentage': delta_3months['percentage'],
                                'health': health})

    def _get_subscription_health(self):
        self.ensure_one()
        domain = [('id', '=', self.id)]
        # avoid computing domain for False values and empty domains []
        bad_health_domain = bool(self.sale_order_template_id.bad_health_domain) and domain + literal_eval(
            self.sale_order_template_id.bad_health_domain.strip())
        good_health_domain = bool(self.sale_order_template_id.bad_health_domain) and domain + literal_eval(
            self.sale_order_template_id.good_health_domain.strip())
        if bad_health_domain and self.search_count(bad_health_domain):
            health = 'bad'
        elif good_health_domain and self.search_count(good_health_domain):
            health = 'done'
        else:
            health = 'normal'
        return health

    def _get_portal_return_action(self):
        """ Return the action used to display orders when returning from customer portal. """
        if self.is_subscription:
            return self.env.ref('sale_subscription.sale_subscription_action')
        else:
            return super(SaleOrder, self)._get_portal_return_action()

    ####################
    # Invoicing Methods #
    ####################

    @api.model
    def _cron_recurring_create_invoice(self):
        return self._create_recurring_invoice(automatic=True)

    def _get_invoiceable_lines(self, final=False):
        # override of sale orders to allow creating multiple invoices for the same document
        res = super()._get_invoiceable_lines(final=final)
        today = fields.Date.today()
        res = res.filtered(lambda l: l.temporal_type != 'subscription')
        automatic_invoice = self.env.context.get('recurring_automatic')

        def filter_sub_lines(line):
            if not line.start_date or line.start_date.date() > today:
                # Avoid invoicing lines starting in the future or not starting at all
                return False
            elif line.next_invoice_date and line.next_invoice_date.date() <= today:
                # Invoice due lines
                return True
            elif not line.invoice_lines:
                # Invoice if the line was never invoiced
                return True
            elif float_is_zero(line.product_uom_qty, precision_rounding=line.product_id.uom_id.rounding):
                return False
            elif line.product_id.invoice_policy == 'delivery' and not float_is_zero(line.qty_delivered, precision_rounding=line.product_id.uom_id.rounding):
                return True
            else:
                return False
        if automatic_invoice:
            subscription_lines = self.order_line.filtered(filter_sub_lines)
        else:
            # We invoice all the subscription lines
            subscription_lines = self.order_line.filtered(lambda l: l.temporal_type == 'subscription')

        return res | subscription_lines

    def _subscription_post_success_payment(self, invoice, transaction):
        """ Action done after the successful payment has been performed """
        self.ensure_one()
        invoice.write({'payment_reference': transaction.reference, 'ref': transaction.reference})
        msg_body = _(
            'Automatic payment succeeded. Payment reference: %(ref)s. Amount: %(amount)s. Contract set to: In Progress, Next Invoice: %(inv)s. Email sent to customer.',
            ref=transaction._get_html_link(title=transaction.reference), amount=transaction.amount, inv=self.next_invoice_date)
        self.message_post(body=msg_body)
        self.send_success_mail(transaction, invoice)

    def _get_subscription_mail_payment_context(self, mail_ctx=None):
        self.ensure_one()
        if not mail_ctx:
            mail_ctx = {}
        return {**self._context, **mail_ctx, **{'total_amount': self.amount_total, 'currency_name': self.currency_id.name, 'responsible_email': self.user_id.email}}

    def _update_subscription_payment_failure_values(self,):
        # allow to override the subscription values in case of payment failure
        return {}

    def _handle_subscription_payment_failure(self, invoice, transaction, email_context):
        self.ensure_one()
        current_date = fields.Date.today()
        reminder_mail_template = self.env.ref('sale_subscription.email_payment_reminder', raise_if_not_found=False)
        close_mail_template = self.env.ref('sale_subscription.email_payment_close', raise_if_not_found=False)
        invoice.unlink()
        auto_close_days = self.sale_order_template_id.auto_close_limit or 15
        date_close = self.next_invoice_date + relativedelta(days=auto_close_days)
        close_contract = current_date >= date_close
        _logger.info('Failed to create recurring invoice for contract %s', self.client_order_ref)
        if close_contract:
            close_mail_template.with_context(email_context).send_mail(self.id)
            _logger.debug("Sending Contract Closure Mail to %s for contract %s and closing contract",
                          self.partner_id.email, self.id)
            msg_body = 'Automatic payment failed after multiple attempts. Contract closed automatically.'
            self.message_post(body=msg_body)
            subscription_values = {'state': 'close', 'end_date': current_date, 'payment_exception': False}
        else:
            msg_body = 'Automatic payment failed. Contract set to "To Renew". No email sent this time. Error: %s' % (
                    transaction and transaction.state_message or 'No Payment Method')

            if (fields.Date.today() - self.next_invoice_date).days in [0, 3, 7, 14]:
                email_context.update({'date_close': date_close})
                reminder_mail_template.with_context(email_context).send_mail(self.id)
                _logger.debug("Sending Payment Failure Mail to %s for contract %s and setting contract to pending", self.partner_id.email, self.id)
                msg_body = 'Automatic payment failed. Contract set to "To Renew". Email sent to customer. Error: %s' % (
                        transaction and transaction.state_message or 'No Payment Method')
            self.message_post(body=msg_body)
            batch_tag = self.env.ref('sale_subscription.invoice_batch', raise_if_not_found=False)
            subscription_values = {'to_renew': True, 'payment_exception': False}
            if batch_tag:
                subscription_values.update({'account_tag_ids':  [Command.link(batch_tag.id)]})
        subscription_values.update(self._update_subscription_payment_failure_values())
        self.write(subscription_values)

    @api.model
    def _get_automatic_subscription_values(self):
        return {'to_renew': True}

    def _recurring_invoice_domain(self, extra_domain=None):
        if not extra_domain:
            extra_domain = []
        current_date = fields.Date.today()
        batch_tag = self.env.ref('sale_subscription.invoice_batch', raise_if_not_found=False)
        search_domain = [('account_tag_ids', 'not in', batch_tag.id),
                         ('is_subscription', '=', True),
                         ('subscription_management', '!=', 'upsell'),
                         ('payment_exception', '=', False),
                         '|', '|', ('next_invoice_date', '<=', current_date), ('end_date', '>=', current_date), ('stage_category', '=', 'progress')]
        if extra_domain:
            search_domain = expression.AND([search_domain, extra_domain])
        return search_domain

    def _create_recurring_invoice(self, automatic=False, batch_size=30):
        auto_commit = not bool(config['test_enable'] or not config['test_file'])
        Mail = self.env['mail.mail']
        stages_in_progress = self.env['sale.order.stage'].search([('category', '=', 'progress')])
        if len(self) > 0:
            all_subscriptions = self.filtered(lambda so: so.is_subscription and so.subscription_management != 'upsell' and not so.payment_exception)
            need_cron_trigger = False
        else:
            search_domain = self._recurring_invoice_domain()
            all_subscriptions = self.search(search_domain, limit=batch_size + 1)
            need_cron_trigger = len(all_subscriptions) > batch_size
            if need_cron_trigger:
                all_subscriptions = all_subscriptions[:batch_size]
        if not all_subscriptions:
            return self.env['account.move']

        # don't spam sale with assigned emails.
        all_subscriptions = all_subscriptions.with_context(mail_auto_subscribe_no_notify=True)
        auto_close_subscription = all_subscriptions.filtered_domain([('recurring_rule_boundary', '=', 'limited')])
        all_invoiceable_lines = all_subscriptions.with_context(recurring_automatic=automatic)._get_invoiceable_lines(final=False)
        auto_close_subscription._subscription_auto_close_and_renew(all_invoiceable_lines)
        batch_tag = self.env.ref('sale_subscription.invoice_batch', raise_if_not_found=False)
        lines_to_reset_qty = self.env['sale.order.line'] # qty_delivered is set to 0 after invoicing for invoice_policy = delivery
        account_moves = self.env['account.move']
        if auto_commit:
            self.env.cr.commit()
        for subscription in all_subscriptions:
            if subscription.stage_id not in stages_in_progress:
                continue
            try:
                subscription = subscription[0] # Trick to not prefetch other subscriptions, as the cache is currently invalidated at each iteration
                # in rare occurrences (due to external issues not related with Odoo), we may have
                # our crons running on multiple workers thus doing work in parallel
                # to avoid processing a subscription that might already be processed
                # by a different worker, we check that it has not already been set to "in exception"
                if subscription.payment_exception:
                    continue
                if auto_commit:
                    self.env.cr.commit() # To avoid a rollback in case something is wrong, we create the invoices one by one
                invoiceable_lines = all_invoiceable_lines.filtered(lambda l: l.order_id.id == subscription.id)
                if not invoiceable_lines and automatic:
                    # We avoid raising UserError(self._nothing_to_invoice_error_message()) in a cron
                    continue
                try:
                    invoice = subscription.with_context(recurring_automatic=automatic)._create_invoices()
                    # Only update the invoice date if there is already one invoice for the lines and when the so is not done
                    # done contract are finished or renewed
                    if invoiceable_lines.order_id.state == 'sale':
                        invoiceable_lines._update_next_invoice_date(force=False)
                    lines_to_reset_qty |= invoiceable_lines
                except TransactionRollbackError:
                    raise
                except Exception:
                    if auto_commit:
                        self.env.cr.rollback()
                    # we suppose that the payment is run only once a day
                    email_context = subscription._get_subscription_mail_payment_context()
                    error_message = _("Error during renewal of contract %s (Payment not recorded)", subscription.name)
                    _logger.exception(error_message)
                    mail = Mail.create({'body_html': error_message, 'subject': error_message, 'email_to': email_context['responsible_email'], 'auto_delete': True})
                    mail.send()
                    continue
                if auto_commit:
                    self.env.cr.commit()
                # Handle automatic payment or invoice posting
                existing_invoices = subscription._handle_automatic_invoices(auto_commit, invoice)
                account_moves |= existing_invoices
                subscription.with_context(mail_notrack=True).write({'payment_exception': False})
            except Exception:
                _logger.exception("Error during renewal of contract %s", subscription.client_order_ref)
                if auto_commit:
                    self.env.cr.rollback()
            else:
                if auto_commit:
                    self.env.cr.commit()

        lines_to_reset_qty._reset_subscription_quantity_post_invoice()
        self._process_invoices_to_send(auto_commit)
        # There is still some subscriptions to process. Then, make sure the CRON will be triggered again asap.
        if need_cron_trigger:
            if config['test_enable'] or config['test_file']:
                # Test environnement: we launch the next iteration in the same thread
                self.env['sale.order']._create_recurring_invoice(automatic, batch_size)
            else:
                self.env.ref('sale_subscription.account_analytic_cron_for_invoice')._trigger()

        if not need_cron_trigger and batch_tag:
            failing_subscriptions = self.search([('account_tag_ids', 'in', batch_tag.ids)])
            failing_subscriptions.write({'account_tag_ids': [Command.unlink(batch_tag.id)]})

        return account_moves

    def _subscription_auto_close_and_renew(self, all_invoiceable_lines):
        """ Handle contracts that need to be automatically closed/set to renews.
        This method is only called during a cron
        """
        current_date = fields.Date.context_today(self)

        def close_contract(contract):
            # check if the end date has been exceeded
            if contract.end_date and contract.end_date <= current_date:
                return True
            # X days after the Date of the last next invoice the subscription should be closed
            auto_close_days = contract.sale_order_template_id and contract.sale_order_template_id.auto_close_limit or 15
            if contract.sale_order_template_id.payment_mode == 'success_payment' and not contract.payment_token_id:
                # Auto close subscription when payment mode is token, no token is set and the auto close period is passed
                next_invoice_dates = [line.next_invoice_date for line in contract.order_line]
            else:
                next_invoice_dates = [line.next_invoice_date for line in contract.order_line if line.id not in all_invoiceable_lines.ids]
            last_next_invoice_date = next_invoice_dates and max(next_invoice_dates)
            auto_close_date = last_next_invoice_date and last_next_invoice_date.date() + relativedelta(days=auto_close_days)
            if auto_close_date and current_date >= auto_close_date:
                return True
            return False

        close_contract_ids = self.filtered(close_contract)
        close_contract_ids.set_close()
        # pending contract only if they are not going to be invoiced during this job
        pending_contract_ids = self.filtered(
            lambda sub: sub.next_invoice_date and current_date >= sub.next_invoice_date and not all(el in sub.order_line.ids for el in all_invoiceable_lines.ids))
        pending_contract_ids -= close_contract_ids  # remove closed contracts from pending one
        pending_contract_ids.set_to_renew()

    def _handle_automatic_invoices(self, auto_commit, invoices):
        """ This method handle the subscription whose template payment_method is set to validate_send and success_payment """
        Mail = self.env['mail.mail']
        automatic_values = self._get_automatic_subscription_values()
        existing_invoices = invoices
        for order in self:
            invoice = invoices.filtered(lambda inv: inv.invoice_origin == order.name)
            email_context = self._get_subscription_mail_payment_context()
            # Set the contract in exception. If something go wrong, the exception remains.
            order.with_context(mail_notrack=True).write({'payment_exception': True})
            if order.sale_order_template_id.payment_mode == 'validate_send':
                invoice.action_post()
            elif order.sale_order_template_id.payment_mode == 'success_payment':
                try:
                    payment_token = order.payment_token_id
                    transaction = None
                    # execute payment
                    if payment_token:
                        if not payment_token.partner_id.country_id:
                            msg_body = 'Automatic payment failed. Contract set to "To Renew". No country specified on payment_token\'s partner'
                            order.message_post(body=msg_body)
                            order.with_context(mail_notrack=True).write(automatic_values)
                            invoice.unlink()
                            existing_invoices -= invoice
                            if auto_commit:
                                self.env.cr.commit()
                            continue
                        transaction = order._do_payment(payment_token, invoice)
                        # commit change as soon as we try the payment so we have a trace in the payment_transaction table
                        if auto_commit:
                            self.env.cr.commit()
                    # if transaction is a success, post a message
                    if transaction and transaction.state == 'done':
                        order.with_context(mail_notrack=True).write({'payment_exception': False})
                        self._subscription_post_success_payment(invoice, transaction)
                        if auto_commit:
                            self.env.cr.commit()
                    # if no transaction or failure, log error, rollback and remove invoice
                    if not payment_token or (transaction and transaction.state != 'done'):
                        if auto_commit:
                            # prevent rollback during tests
                            self.env.cr.rollback()
                        order._handle_subscription_payment_failure(invoice, transaction, email_context)
                        existing_invoices -= invoice  # It will be unlinked in the call above
                except Exception:
                    if auto_commit:
                        # prevent rollback during tests
                        self.env.cr.rollback()
                    # we suppose that the payment is run only once a day
                    last_transaction = self.env['payment.transaction'].search([('reference', 'like', self.client_order_ref)], limit=1)
                    error_message = "Error during renewal of contract %s (%s)" \
                                    % (order.client_order_ref, 'Payment recorded: %s' % last_transaction.reference \
                                    if last_transaction and last_transaction.state == 'done' else 'Payment not recorded')
                    _logger.exception(error_message)
                    mail = Mail.create({'body_html': '%s\n<pre>%s</pre>' % (error_message), 'subject': error_message,
                                        'email_to': email_context.get('responsible_email'), 'auto_delete': True})
                    mail.send()

        return existing_invoices

    def cron_subscription_expiration(self):
        today = fields.Date.today()
        next_month = today + relativedelta(months=1)
        # set to pending if date is in less than a month
        domain_pending = [('is_subscription', '=', True), ('end_date', '<', next_month), ('stage_category', '=', 'progress')]
        subscriptions_pending = self.search(domain_pending)
        subscriptions_pending.set_to_renew()
        # set to close if date is passed or if locked sale order is passed
        domain_close = [
            ('is_subscription', '=', True),
            ('end_date', '<', today),
            ('state', 'in', ['sale', 'done']),
            '|',
            ('stage_category', '=', 'progress'),
            ('to_renew', '=', True)]
        subscriptions_close = self.search(domain_close)
        subscriptions_close.set_close()
        return dict(pending=subscriptions_pending.ids, closed=subscriptions_close.ids)

    def _get_subscription_delta(self, date):
        self.ensure_one()
        delta, percentage = False, False
        subscription_log = self.env['sale.order.log'].search([
            ('order_id', '=', self.id),
            ('event_type', 'in', ['0_creation', '1_change', '2_transfer']),
            ('event_date', '<=', date)],
            order='event_date desc',
            limit=1)
        if subscription_log:
            delta = self.recurring_monthly - subscription_log.recurring_monthly
            percentage = delta / subscription_log.recurring_monthly if subscription_log.recurring_monthly != 0 else 100
        return {'delta': delta, 'percentage': percentage}

    def _nothing_to_invoice_error_message(self):
        self.ensure_one()
        error_message = super()._nothing_to_invoice_error_message()
        if self.is_subscription:
            error_message += _(
                "\n- You should wait for the current subscription period to pass. New quantities to invoice will be ready "
                "at the end of the current period."
            )
        return error_message

    def _do_payment(self, payment_token, invoice):
        tx_obj = self.env['payment.transaction']
        values = []
        for subscription in self:
            reference = tx_obj._compute_reference(
                payment_token.acquirer_id.provider, prefix=subscription.client_order_ref
            )
            # There is no sub_id field to rely on
            values.append({
                'acquirer_id': payment_token.acquirer_id.id,
                'reference': reference,
                'amount': invoice.amount_total,
                'currency_id': invoice.currency_id.id,
                'partner_id': subscription.partner_id.id,
                'token_id': payment_token.id,
                'operation': 'offline',
                'invoice_ids': [(6, 0, [invoice.id])],
                'callback_model_id': self.env['ir.model']._get_id(subscription._name),
                'callback_res_id': subscription.id,
                'callback_method': 'reconcile_pending_transaction'})
        transactions = tx_obj.create(values)
        for tx in transactions:
            tx._send_payment_request()
        return transactions

    def send_success_mail(self, tx, invoice):
        self.ensure_one()
        if not invoice._is_ready_to_be_sent():
            return
        current_date = fields.Date.today()
        next_date = self.next_invoice_date or current_date
        # if no recurring next date, have next invoice be today + interval
        if not self.next_invoice_date:
            invoicing_periods = [next_date + get_timedelta(pricing_id.duration, pricing_id.unit) for pricing_id in self.order_line.pricing_id]
            next_date = invoicing_periods and min(invoicing_periods) or current_date
        email_context = {**self.env.context.copy(),
                         **{'payment_token': self.payment_token_id.name,
                            'renewed': True,
                            'total_amount': tx.amount,
                            'next_date': next_date,
                            'previous_date': self.next_invoice_date,
                            'email_to': self.partner_id.email,
                            'code': self.client_order_ref,
                            'currency': self.pricelist_id.currency_id.name,
                            'date_end': self.end_date}}
        _logger.debug("Sending Payment Confirmation Mail to %s for subscription %s", self.partner_id.email, self.id)
        template = self.env.ref('sale_subscription.email_payment_success')

        # This function can be called by the public user via the callback_method set in
        # /my/subscription/transaction/. The email template contains the invoice PDF in
        # attachment, so to render it successfully sudo() is not enough.
        if self.env.su:
            template = template.with_user(SUPERUSER_ID)
        return template.with_context(email_context).send_mail(invoice.id)

    @api.model
    def _process_invoices_to_send(self, auto_commit):
        # Retrieve the invoice to send mails.
        self._cr.execute("""
        SELECT DISTINCT aml.move_id,move.date
          FROM account_move_line aml
          JOIN sale_order so ON so.id = aml.subscription_id
          JOIN sale_order_template sot ON sot.id = so.sale_order_template_id
          JOIN account_move move ON move.id = aml.move_id
         WHERE move.state = 'posted'
           AND move.is_move_sent IS FALSE
           AND sot.payment_mode = 'validate_send'
      ORDER BY move.date DESC
        """)
        invoice_to_send_ids = [row[0] for row in self._cr.fetchall()]
        invoices_to_send = self.env['account.move'].browse(invoice_to_send_ids)
        for invoice in invoices_to_send:
            if invoice._is_ready_to_be_sent():
                subscription = invoice.line_ids.subscription_id
                subscription.validate_and_send_invoice(auto_commit, invoice)

    def validate_and_send_invoice(self, auto_commit, invoice):
        self.ensure_one()
        email_context = {**self.env.context.copy(), **{
            'total_amount': invoice.amount_total,
            'email_to': self.partner_id.email,
            'code': self.client_order_ref,
            'currency': self.pricelist_id.currency_id.name,
            'date_end': self.end_date,
            'mail_notify_force_send': False,
            'no_new_invoice': True}}
        _logger.debug("Sending Invoice Mail to %s for subscription %s", self.partner_id.email, self.id)
        invoice.with_context(email_context).message_post_with_template(
                self.sale_order_template_id.invoice_mail_template_id.id, auto_commit=auto_commit)
        invoice.is_move_sent = True

    def _send_subscription_rating_mail(self, force_send=False):
        for subscription in self:
            if not subscription.stage_id.rating_template_id or not subscription.is_subscription:
                continue
            subscription.rating_send_request(
                subscription.stage_id.rating_template_id,
                lang=subscription.partner_id.lang,
                force_send=force_send)

    def _reconcile_and_assign_token(self, tx):
        """ Callback method to make the reconciliation and assign the payment token.
        :param recordset tx: The transaction that created the token, and that must be reconciled,
                             as a `payment.transaction` record
        :return: Whether the conditions were met to execute the callback
        """
        self.ensure_one()

        if tx.renewal_allowed:
            self._assign_token(tx)
            self._reconcile_and_send_mail(tx)
            return True
        return False

    def _assign_token(self, tx):
        """ Callback method to assign a token after the validation of a transaction.
        Note: self.ensure_one()
        :param recordset tx: The validated transaction, as a `payment.transaction` record
        :return: Whether the conditions were met to execute the callback
        """
        self.ensure_one()
        if tx.renewal_allowed:
            self.payment_token_id = tx.token_id.id
            return True
        return False

    def _reconcile_and_send_mail(self, tx):
        """ Callback method to make the reconciliation and send a confirmation email.
        :param recordset tx: The transaction to reconcile, as a `payment.transaction` record
        """
        self.ensure_one()
        if self.reconcile_pending_transaction(tx):
            invoice = tx.invoice_ids[0]
            self.send_success_mail(tx, invoice)
            msg_body = _(
                "Manual payment succeeded. Payment reference: %s; Amount: %(amount)s. Invoice %(invoice)s",
                tx_model=tx._get_html_link(), amount=tx.amount,
                invoice=invoice._get_html_link(),
            )
            self.message_post(body=msg_body)
            return True
        return False

    def reconcile_pending_transaction(self, tx):
        """ Callback method to make the reconciliation.
        :param recordset tx: The transaction to reconcile, as a `payment.transaction` record
        :return: Whether the transaction was successfully reconciled
        """
        self.ensure_one()
        if tx.renewal_allowed:  # The payment is confirmed, it can be reconciled
            # avoid to create an invoice when one is already linked
            if not tx.invoice_ids:
                # Create the invoice that was either deleted in a controller or failed to be created by the _create_recurring_invoice method
                invoiceable_lines = self._get_invoiceable_lines()
                invoice = self.with_context(recurring_automatic=True)._create_invoices()
                invoice.write({'ref': tx.reference, 'payment_reference': tx.reference})
                # Only update the invoice date if there is already one invoice for the lines and when the so is not done
                # locked contract are finished or renewed
                invoice.message_post_with_view(
                    'mail.message_origin_link',
                    values={'self': invoice, 'origin': self},
                    subtype_id=self.env.ref('mail.mt_note').id
                )
                tx.invoice_ids = invoice.id,
                update_next_invoice_date = True
            else:
                self.env.cr.execute(
                    """
                    SELECT  order_line_id
                      FROM sale_order_line_invoice_rel
                     WHERE invoice_line_id IN %s
                    """, (tuple(tx.invoice_ids.invoice_line_ids.ids), ))
                line_ids = [line['order_line_id'] for line in self.env.cr.dictfetchall()]
                invoiceable_lines = self.order_line.filtered(lambda l: l.id in line_ids)
                update_next_invoice_date = False # the next invoice date was updated in

            # Renew the subscription
            if self.state == 'sale' and update_next_invoice_date:
                invoiceable_lines._update_next_invoice_date()
            self.set_open()
            return True
        return False
