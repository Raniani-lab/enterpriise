# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models, api


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    subscription_id = fields.Many2one('sale.subscription')
    subscription_start_date = fields.Date(string='Subscription Start Date', related='subscription_id.date_start', readonly=True, store=True)
    subscription_end_date = fields.Date(string='Subscription End Date', related='subscription_id.date', readonly=True, store=True)
    subscription_mrr = fields.Float(string='Monthly Recurring Revenue', related='subscription_id.recurring_monthly', readonly=True, store=True)
