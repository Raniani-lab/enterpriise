# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import fields, models

class HrExpenseSheet(models.Model):
    _inherit = "hr.expense.sheet"

    refund_in_payslip = fields.Boolean(
        string="Reimburse In Next Payslip", states={'done': [('readonly', True)], 'post': [('readonly', True)]},
        groups='hr_expense.group_hr_expense_team_approver')
    payslip_id = fields.Many2one('hr.payslip', string="Payslip", readonly=True)
