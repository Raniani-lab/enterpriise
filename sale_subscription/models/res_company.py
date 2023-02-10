# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    # Default subscription parameters
    subscription_default_recurrence_id = fields.Many2one('sale.temporal.recurrence', string='Default Recurrence')
