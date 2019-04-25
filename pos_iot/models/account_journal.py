# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models, api

class AccountJournal(models.Model):
    _inherit = 'account.journal'

    use_payment_terminal = fields.Boolean('Use a Payment Terminal', help='Record payments using a payment terminal')
