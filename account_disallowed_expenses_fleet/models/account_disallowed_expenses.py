# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountDisallowedExpensesCategory(models.Model):
    _inherit = 'account.disallowed.expenses.category'

    car_category = fields.Boolean('Car Category', help='This checkbox makes the vehicle mandatory while booking a vendor bill.')

    @api.depends('car_category')
    def _compute_display_name(self):
        super()._compute_display_name()
        # Do no display the rate in the name for car expenses
        for category in self:
            if category.car_category:
                category.display_name = f'{category.code} - {category.name}'
