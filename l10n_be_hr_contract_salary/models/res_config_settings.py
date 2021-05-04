# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    default_holidays = fields.Float(string="Paid Time Off", default_model="hr.contract")
    internal_fleet_category_id = fields.Many2one(
        related='company_id.internal_fleet_category_id',
        readonly=False,
    )
