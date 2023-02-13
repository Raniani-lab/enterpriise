# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tools import get_timedelta


class SaleOrderRecurrence(models.Model):
    _name = 'sale.temporal.recurrence'
    _description = 'Sale temporal Recurrence'
    _order = 'unit,duration'

    active = fields.Boolean(default=True)
    name = fields.Char(translate=True, required=True, default="Monthly")
    duration = fields.Integer(string="Duration", required=True, default=1,
                              help="Minimum duration before this rule is applied. If set to 0, it represents a fixed temporal price.")
    unit = fields.Selection([('day', 'Days'), ("week", "Weeks"), ("month", "Months"), ('year', 'Years')],
        string="Unit", required=True, default='month')
    temporal_unit_display = fields.Char(compute='_compute_temporal_unit_display')

    _sql_constraints = [
        ('temporal_recurrence_duration', "CHECK(duration >= 0)", "The pricing duration has to be greater or equal to 0."),
    ]

    def get_recurrence_timedelta(self):
        self.ensure_one()
        return get_timedelta(self.duration, self.unit)

    @api.depends('duration', 'unit')
    def _compute_temporal_unit_display(self):
        for order in self:
            if order.unit == 'day':
                order.temporal_unit_display = _('per %s days', order.duration) if order.duration > 1 else _('per day')
            elif order.unit == 'week':
                order.temporal_unit_display = _('per %s weeks', order.duration) if order.duration > 1 else _('per week')
            elif order.unit == 'month':
                order.temporal_unit_display = _('per %s months', order.duration) if order.duration > 1 else _('per month')
            elif order.unit == 'year':
                order.temporal_unit_display = _('per %s years', order.duration) if order.duration > 1 else _('per year')
