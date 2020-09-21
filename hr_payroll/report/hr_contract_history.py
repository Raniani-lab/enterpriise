# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class ContractHistory(models.Model):
    _inherit = 'hr.contract.history'

    wage_type = fields.Selection(related='structure_type_id.wage_type', readonly=True)
