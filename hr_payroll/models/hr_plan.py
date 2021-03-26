# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class HrPlan(models.Model):
    _inherit = 'hr.plan'

    trigger_onboarding = fields.Selection(
        selection_add=[
            ('contract_start', 'Running Contract Date'),
        ],
        ondelete={'contract_start': 'cascade'},
    )
    trigger_offboarding = fields.Selection(
        selection_add=[
            ('contract_end', 'End Contract Date'),
        ],
        ondelete={'contract_end': 'cascade'},
    )
