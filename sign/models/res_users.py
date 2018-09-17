# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    sign_signature = fields.Binary(string="Digital Signature")
    sign_initials = fields.Binary(string="Digitial Initials")
