# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.addons.sale_subscription.models.sale_order import SUBSCRIPTION_STATES

class SaleOrderLog(models.Model):
    _name = 'sale.order.log'
    _description = 'Sale Order Log'
    _order = 'event_date desc, id desc'

    order_id = fields.Many2one(
        'sale.order', string='Sale Order',
        required=True, ondelete='cascade', readonly=True,
        auto_join=True
    )
    create_date = fields.Datetime(string='Date', readonly=True)
    event_type = fields.Selection(
        string='Type of event',
        selection=[('0_creation', 'New'),
                   ('1_expansion', 'Expansion'),
                   ('15_contraction', 'Contraction'),
                   ('2_churn', 'Churn'),
                   ('3_transfer', 'Transfer')],
        required=True,
        readonly=True,
        index=True,
    )
    recurring_monthly = fields.Monetary(string='New MRR', required=True,
                                        help="MRR, after applying the changes of that particular event", readonly=True)
    subscription_state = fields.Selection(selection=SUBSCRIPTION_STATES, required=True, help="Subscription stage category when the change occurred")
    user_id = fields.Many2one('res.users', string='Salesperson')
    team_id = fields.Many2one('crm.team', string='Sales Team', ondelete="set null")
    amount_signed = fields.Monetary(index=True)
    currency_id = fields.Many2one('res.currency', string='Currency', required=True, readonly=True)
    event_date = fields.Date(string='Event Date', required=True, index=True)
    company_id = fields.Many2one('res.company', string='Company', related='order_id.company_id', store=True, readonly=True)
    origin_order_id = fields.Many2one('sale.order', string='Origin Contract', store=True, index=True,
                                      compute='_compute_origin_order_id')

    @api.depends('order_id')
    def _compute_origin_order_id(self):
        for log in self:
            log.origin_order_id = log.order_id.origin_order_id or log.order_id

    @api.depends('order_id')
    def _compute_origin_order_id(self):
        for log in self:
            log.origin_order_id = log.order_id.origin_order_id or log.order_id
