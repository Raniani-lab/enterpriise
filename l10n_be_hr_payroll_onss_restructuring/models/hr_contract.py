# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class HrContract(models.Model):
    _inherit = 'hr.contract'

    l10n_be_onss_restructuring = fields.Boolean(string="Manage ONSS Reduction for Restructuring")
