# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _

class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    def turn_as_deferred_revenue(self):
        return self._turn_as_asset('sale', _("Turn as a deferred revenue"), self.env.ref('account_deferred_revenue.view_account_asset_revenue_modal'))

    def turn_as_deferred_expense(self):
        return self._turn_as_asset('expense', _("Turn as a deferred expense"), self.env.ref('account_deferred_revenue.view_account_asset_expense_modal'))
