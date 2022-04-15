# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    onss_expeditor_number = fields.Char(
        related="company_id.onss_expeditor_number",
        readonly=False,
        groups="hr_payroll.group_hr_payroll_user")
    onss_pem_certificate = fields.Binary(
        related="company_id.onss_pem_certificate",
        readonly=False,
        groups="base.group_system")
    onss_pem_passphrase = fields.Char(
        related="company_id.onss_pem_passphrase",
        readonly=False,
        groups="base.group_system")
