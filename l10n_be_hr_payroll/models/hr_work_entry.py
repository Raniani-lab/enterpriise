#-*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HrWorkEntryType(models.Model):
    _inherit = 'hr.work.entry.type'

    meal_voucher = fields.Boolean(
        string="Meal Voucher", default=False,
        help="Work entries counts for meal vouchers")
    private_car = fields.Boolean(
        string="Private Car Reimbursement",
        help="Work entries counts for private car reimbursement")
    representation_fees = fields.Boolean(
        string="Representation Fees",
        help="Work entries counts for representation fees")
    dmfa_code = fields.Char(string="DMFA code")
    leave_right = fields.Boolean(
        string="Keep Time Off Right", default=False,
        help="Work entries counts for time off right for next year.")

    @api.model
    def get_work_entry_type_benefits(self):
        return ['meal_voucher', 'private_car', 'representation_fees']


class HrWorkEntry(models.Model):
    _inherit = 'hr.work.entry'

    is_credit_time = fields.Boolean(
        string='Credit time', readonly=True,
        help="This is a credit time work entry.")

    def _get_leaves_entries_outside_schedule(self):
        return super()._get_leaves_entries_outside_schedule().filtered(lambda w: not w.is_credit_time)

    def _get_duration_is_valid(self):
        return super()._get_duration_is_valid() and not self.is_credit_time
