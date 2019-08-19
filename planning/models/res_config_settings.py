# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    planning_generation_interval = fields.Integer("Rate of shift generation", required=True,
        related="company_id.planning_generation_interval", readonly=False, help="Delay for the rate at which recurring shifts should be generated")
    planning_generation_uom = fields.Selection([
        ('week', 'Week(s)'),
        ('month', 'Month(s)')
    ], related='company_id.planning_generation_uom', required=True, default="month", readonly=False, help="Unit for the rate at which recurring shifts should be generated")

    @api.constrains('planning_generation_uom', 'planning_generation_interval')
    def _check_planning_generation_interval(self):
        # interval should stay clipped between 1 and 6 months
        # if it goes under 1, doesn't make sense
        # if it goes higher than 6, this could be a performance problem (repeating forecasts every day during many month takes time)
        if self.planning_generation_uom == 'month' and not (1 <= self.planning_generation_interval <= 6):  # months
            raise ValidationError(_('Forecast generation span should be between 1 and 6 months'))
        elif not (1 <= self.planning_generation_interval <= 6 * 4):  # weeks
            raise ValidationError(_('Forecast generation span should be between 1 and 24 weeks'))
