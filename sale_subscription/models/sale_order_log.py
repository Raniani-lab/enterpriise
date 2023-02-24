# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


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
        selection=[('0_creation', 'Creation'), ('1_change', 'MRR change'), ('2_churn', 'Churn'), ('3_transfer', 'Transfer')],
        required=True,
        readonly=True
    )
    recurring_monthly = fields.Monetary(string='New MRR', required=True,
                                        help="MRR, after applying the changes of that particular event", readonly=True)
    subscription_state = fields.Selection(selection=[
        ('1_draft', 'Quotation'),         # Quotation for a new subscription
        ('3_progress', 'In Progress'),    # Active Subscription or confirmed renewal for active subscription
        ('6_churn', 'Churned'),           # Closed or ended subscription
        ('2_renewal', 'Renewal Quotation'), # Renewal Quotation for existing subscription
        ('5_renewed', 'Renewed'),         # Active or ended subscription that has been renewed
        ('4_paused', 'Paused'),           # Active subscription with paused invoicing
        ('7_upsell', 'Upsell'),           # Quotation or SO upselling a subscription
    ], required=True, default='1_draft', help="Subscription stage category when the change occurred")
    user_id = fields.Many2one('res.users', string='Salesperson')
    team_id = fields.Many2one('crm.team', string='Sales Team', ondelete="set null")
    amount_signed = fields.Monetary(string='Change in MRR', readonly=True)
    currency_id = fields.Many2one('res.currency', string='Currency', required=True, readonly=True)
    amount_company_currency = fields.Monetary(
        string='Change in MRR (company currency)', currency_field='company_currency_id',
        compute="_compute_amount_company_currency", store=True, readonly=True)
    event_date = fields.Date(string='Event Date', required=True)
    company_currency_id = fields.Many2one('res.currency', string='Company Currency', related='company_id.currency_id', store=True, readonly=True)
    company_id = fields.Many2one('res.company', string='Company', related='order_id.company_id', store=True, readonly=True)

    @api.depends('company_id', 'company_currency_id', 'amount_signed', 'event_date')
    def _compute_amount_company_currency(self):
        for log in self:
            log.amount_company_currency = log.currency_id._convert(from_amount=log.amount_signed, to_currency=log.company_currency_id, date=log.event_date, company=log.company_id)
