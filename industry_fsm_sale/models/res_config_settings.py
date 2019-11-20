# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    group_industry_fsm_quotations = fields.Boolean(string="Extra Quotations", implied_group="industry_fsm_sale.group_fsm_quotation_from_task")
