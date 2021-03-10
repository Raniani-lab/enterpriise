# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class HrPayslip(models.Model):
    _inherit = 'hr.payslip'

    expense_sheet_ids = fields.One2many(
        'hr.expense.sheet', 'payslip_id', string='Expenses', readonly=False,
        help="Expenses to reimburse to employee.",
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]})
    expenses_count = fields.Integer(compute='_compute_expenses_count')

    @api.depends('expense_sheet_ids.expense_line_ids', 'expense_sheet_ids.payslip_id')
    def _compute_expenses_count(self):
        for payslip in self:
            payslip.expenses_count = len(payslip.mapped('expense_sheet_ids.expense_line_ids'))

    @api.onchange('input_line_ids')
    def _onchange_input_line_ids(self):
        expense_type = self.env.ref('hr_payroll_expense.expense_other_input', raise_if_not_found=False)
        if not self.input_line_ids.filtered(lambda line: line.input_type_id == expense_type):
            self.expense_sheet_ids.write({'payslip_id': False})

    @api.model_create_multi
    def create(self, vals_list):
        payslips = super().create(vals_list)
        draft_slips = payslips.filtered(lambda p: p.employee_id and p.state == 'draft')
        if not draft_slips:
            return payslips
        sheets = self.env['hr.expense.sheet'].search([
            ('employee_id', 'in', draft_slips.mapped('employee_id').ids),
            ('state', '=', 'approve'),
            ('payment_mode', '=', 'own_account'),
            ('refund_in_payslip', '=', True),
            ('payslip_id', '=', False)])
        for slip in draft_slips:
            payslip_sheets = sheets.filtered(lambda s: s.employee_id == slip.employee_id)
            slip.expense_sheet_ids = [(5, 0, 0)] + [(4, s.id, False) for s in payslip_sheets]
        return payslips

    def write(self, vals):
        res = super().write(vals)
        if 'expense_sheet_ids' in vals:
            self._compute_expense_input_line_ids()
        return res

    def _compute_expense_input_line_ids(self):
        expense_type = self.env.ref('hr_payroll_expense.expense_other_input', raise_if_not_found=False)
        for payslip in self:
            total = sum(payslip.expense_sheet_ids.mapped('total_amount'))
            if not total or not expense_type:
                continue
            lines_to_remove = payslip.input_line_ids.filtered(lambda x: x.input_type_id == expense_type)
            input_lines_vals = [(2, line.id, False) for line in lines_to_remove]
            input_lines_vals.append((0, 0, {
                'amount': total,
                'input_type_id': expense_type.id
            }))
            payslip.update({'input_line_ids': input_lines_vals})

    def action_payslip_done(self):
        res = super(HrPayslip, self).action_payslip_done()
        for expense in self.expense_sheet_ids:
            expense.action_sheet_move_create()
            expense.set_to_paid()
        return res

    def open_expenses(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Reimbursed Expenses'),
            'res_model': 'hr.expense',
            'view_mode': 'tree,form',
            'domain': [('id', 'in', self.mapped('expense_sheet_ids.expense_line_ids').ids)],
        }
