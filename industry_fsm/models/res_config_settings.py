# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.osv import expression


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    module_industry_fsm_report = fields.Boolean("Worksheets")
    module_industry_fsm_sale = fields.Boolean('Time and Material')

    @api.model
    def _get_basic_project_domain(self):
        return expression.AND([super()._get_basic_project_domain(), [('is_fsm', '=', False)]])
