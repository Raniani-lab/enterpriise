# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _


class AccountMoveLine(models.Model):
    _name = "account.move.line"
    _inherit = "account.move.line"

    expected_pay_date = fields.Date('Expected Date',
                                    help="Expected payment date as manually set through the customer statement"
                                         "(e.g: if you had the customer on the phone and want to remember the date he promised he would pay)")

    def change_expected_date(self, params=None):
        self.ensure_one()

        if params and 'expected_pay_date' in params:
            old_date = self.expected_pay_date

            self.write({'expected_pay_date': params['expected_pay_date']})

            partner_msg = _('Expected pay date has been changed from %s to %s for invoice %s') % (old_date or _('any'), self.expected_pay_date, self.move_id.name)
            self.partner_id.message_post(body=partner_msg)

            move_msg = _('Expected pay date has been changed from %s to %s') % (old_date or _('any'), self.expected_pay_date)
            self.move_id.message_post(body=move_msg)
