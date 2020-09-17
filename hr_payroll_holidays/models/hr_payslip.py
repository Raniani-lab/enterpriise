# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _
from odoo.exceptions import ValidationError


class HrPayslip(models.Model):
    _inherit = 'hr.payslip'

    def compute_sheet(self):
        if self.filtered(lambda p: p.is_regular):
            employees = self.mapped('employee_id')
            leaves_to_defer = self.env['hr.leave'].search([
                ('employee_id', 'in', employees.ids),
                ('to_defer', '=', True)
            ])
            if leaves_to_defer:
                raise ValidationError(_(
                    'There is some remaining time off to defer for these employees: \n\n %s',
                    ','.join(e.display_name for e in leaves_to_defer.mapped('employee_id'))))
        return super().compute_sheet()
