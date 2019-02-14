# -*- coding: utf-8 -*-

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    appraisal_min_period = fields.Integer(string="Minimum number of months between appraisals", default=6, config_parameter='hr_appraisal.appraisal_min_period')
    appraisal_max_period = fields.Integer(string="Maximum number of months between appraisals", default=12, config_parameter='hr_appraisal.appraisal_max_period')
