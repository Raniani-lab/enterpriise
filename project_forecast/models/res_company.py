# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    forecast_generation_span_interval = fields.Integer(
        string='Rate of forecast generation',
        required=True,
        help="Delay for the rate at which recurring forecasts should be generated",
        readonly=False,
        default=1,
    )
    forecast_generation_span_uom = fields.Selection([
        ('week', 'Week(s)'),
        ('month', 'Month(s)')
    ], required=True,
        help="Unit for the rate at which recurring forecasts should be generated",
        readonly=False,
        default='month',
    )
    forecast_default_view = fields.Selection([
        ('gantt', 'Gantt'),
        ('grid', 'Grid')
    ], default="gantt", required=True, help="Which view should be seen by default for forecasts")
