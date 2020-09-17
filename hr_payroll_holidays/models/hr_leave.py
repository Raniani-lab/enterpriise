# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _


class HrLeave(models.Model):
    _inherit = 'hr.leave'

    to_defer = fields.Boolean()

    def action_validate(self):
        all_payslips = self.env['hr.payslip'].search([
            ('employee_id', 'in', self.mapped('employee_id').ids),
            ('state', '=', 'done')]).filtered(lambda p: p.is_regular)
        for leave in self:
            if any(payslip.employee_id == leave.employee_id and (payslip.date_from <= leave.date_to.date() and payslip.date_to >= leave.date_from.date()) for payslip in all_payslips):
                leave.to_defer = True
        return super(HrLeave, self).action_validate()

    def _cancel_work_entry_conflict(self):
        leaves_to_defer = self.filtered(lambda l: l.to_defer)
        for leave in leaves_to_defer:
            leave.activity_schedule(
                'hr_payroll_holidays.mail_activity_data_hr_leave_to_defer',
                summary=_('Validated Time Off to Defer'),
                note=_('Please create manually the work entry for <a href="#" data-oe-model="%s" data-oe-id="%s">%s</a>') % (
                    leave.employee_id._name, leave.employee_id.id, leave.employee_id.display_name),
                user_id=leave.employee_id.company_id.deferred_time_off_manager.id or self.env.ref('base.user_admin').id)
        return super(HrLeave, self - leaves_to_defer)._cancel_work_entry_conflict()

    def activity_feedback(self, act_type_xmlids, user_id=None, feedback=None):
        if 'hr_payroll_holidays.mail_activity_data_hr_leave_to_defer' in act_type_xmlids:
            self.write({'to_defer': False})
        return super().activity_feedback(act_type_xmlids, user_id=user_id, feedback=feedback)
