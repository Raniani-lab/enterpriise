# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    onss_expeditor_number = fields.Char(
        string="ONSS Expeditor Number", groups="base.group_system",
        help="ONSS Expeditor Number provided when registering service on the technical user")
    onss_pem_certificate = fields.Binary(
        string="PEM Certificate", groups="base.group_system",
        help="Certificate to allow access to batch declarations")
    onss_pem_passphrase = fields.Char(
        string="PEM Passphrase", groups="base.group_system",
        help="Certificate to allow access to batch declarations")

    def _neutralize(self):
        super()._neutralize()
        self.flush_model()
        self.invalidate_model()
        self.env.cr.execute("""
            UPDATE res_company
            SET onss_expeditor_number = 'dummy',
                onss_pem_passphrase = 'dummy'
        """)
