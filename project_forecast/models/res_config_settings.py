# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    forecast_generation_span_interval = fields.Integer(
        string='Rate of forecast generation',
        related="company_id.forecast_generation_span_interval",
        required=True,
        help="Delay for the rate at which recurring forecasts should be generated",
        readonly=False
    )
    forecast_generation_span_uom = fields.Selection([
        ('week', 'Weeks'),
        ('month', 'Months')
    ], related='company_id.forecast_generation_span_uom',
        required=True,
        default="month",
        help="Unit for the rate at which recurring forecasts should be generated",
        readonly=False
    )

    @api.constrains('forecast_generation_span_uom', 'forecast_generation_span_interval')
    def _check_forecast_generation_span_interval(self):
        # interval should stay clipped between 1 and 6 months
        # if it goes under 1, doesn't make sense
        # if it goes higher than 6, this could be a performance problem (repeating forecasts every day during many month takes time)
        if(self.forecast_generation_span_uom == 'month' and not (1 <= self.forecast_generation_span_interval <= 6)):  # months
            raise ValidationError(_('Forecast generation span should be between 1 and 6 months'))
        elif(not (1 <= self.forecast_generation_span_interval <= 6 * 4)):  # weeks
            raise ValidationError(_('Forecast generation span should be between 1 and 24 weeks'))
