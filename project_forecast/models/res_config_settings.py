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
    forecast_default_view = fields.Selection([
        ('gantt', 'Gantt'),
        ('grid', 'Grid')
    ], string="Default view",
        related="company_id.forecast_default_view",
        default="gantt",
        required=True,
        help="Which view should be seen by default for forecasts",
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

    @api.model
    def get_values(self):
        values = super().get_values()
        view_by_user_gantt = self.env.ref('project_forecast.project_forecast_action_view_by_user_gantt')
        view_by_user_grid = self.env.ref('project_forecast.project_forecast_action_view_by_user_grid')
        gantt_first = view_by_user_gantt.sequence < view_by_user_grid.sequence
        values.update({
            'forecast_default_view': 'gantt' if gantt_first else 'grid'
        })
        return values

    def set_values(self):
        super().set_values()
        view_by_user_gantt = self.env.ref('project_forecast.project_forecast_action_view_by_user_gantt')
        view_by_user_grid = self.env.ref('project_forecast.project_forecast_action_view_by_user_grid')
        view_by_project_gantt = self.env.ref('project_forecast.project_forecast_action_view_by_project_gantt')
        view_by_project_grid = self.env.ref('project_forecast.project_forecast_action_view_by_project_grid')
        if self.forecast_default_view == 'gantt':
            view_by_user_gantt.write({'sequence': 1})
            view_by_user_grid.write({'sequence': 2})
            view_by_project_gantt.write({'sequence': 1})
            view_by_project_grid.write({'sequence': 2})
        else:
            view_by_user_gantt.write({'sequence': 2})
            view_by_user_grid.write({'sequence': 1})
            view_by_project_gantt.write({'sequence': 2})
            view_by_project_grid.write({'sequence': 1})
