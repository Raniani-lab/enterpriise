# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    l10n_cl_report_tasa_ppm = fields.Integer(
        related='company_id.l10n_cl_report_tasa_ppm', string="Tasa PPM (%)",
        readonly=False)
