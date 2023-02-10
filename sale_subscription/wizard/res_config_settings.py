# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # Default subscription parameters
    subscription_default_recurrence_id = fields.Many2one(related='company_id.subscription_default_recurrence_id',
                                                         readonly=False)
