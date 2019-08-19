# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Company(models.Model):
    _inherit = 'res.company'

    planning_generation_interval = fields.Integer("Rate of shift generation", required=True, readonly=False, default=1, help="Delay for the rate at which recurring shift should be generated")
    planning_generation_uom = fields.Selection([
        ('week', 'Week(s)'),
        ('month', 'Month(s)')
    ], required=True, default='month', readonly=False, help="Unit for the rate at which recurring shift should be generated")
