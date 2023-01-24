# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.tools.misc import format_date


class AccountMoveLine(models.Model):
    _name = "account.move.line"
    _inherit = "account.move.line"

    expected_pay_date = fields.Date('Expected Date',
                                    help="Expected payment date as manually set through the customer statement"
                                         "(e.g: if you had the customer on the phone and want to remember the date he promised he would pay)")

    def change_expected_date(self, params=None):
        self.ensure_one()

        if params and 'expected_pay_date' in params:
            old_date = format_date(self.env, self.expected_pay_date) if self.expected_pay_date else _('any')
            self.write({'expected_pay_date': params['expected_pay_date']})

            if self.move_id.move_type == 'out_invoice':
                new_date = format_date(self.env, self.expected_pay_date) if self.expected_pay_date else _('any')
                move_msg = _('Expected payment date for journal item "%s" has been changed from %s to %s on journal entry "%s"') % (self.name, old_date, new_date, self.move_id.name)
                self.partner_id._message_log(body=move_msg)
                self.move_id._message_log(body=move_msg)
