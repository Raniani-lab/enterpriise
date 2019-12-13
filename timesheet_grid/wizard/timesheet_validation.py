# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models
from odoo.osv import expression


class ValidationWizard(models.TransientModel):
    _name = 'timesheet.validation'
    _description = 'Timesheet Validation'

    validation_date = fields.Date('Validate up to')
    validation_line_ids = fields.One2many('timesheet.validation.line', 'validation_id')

    def action_validate(self):
        domain = expression.AND([[('timer_start', '=', False)], self.env['account.analytic.line']._get_domain_for_validation_timesheets()])

        # sudo needed because timesheet approver may not have access on account.analytic.line
        self.validation_line_ids.filtered('validate').mapped('timesheet_ids').sudo().filtered_domain(domain).write({'validated': True})
        return {'type': 'ir.actions.act_window_close'}


class ValidationWizardLine(models.TransientModel):
    _name = 'timesheet.validation.line'
    _description = 'Timesheet Validation Line'

    validation_id = fields.Many2one('timesheet.validation', required=True, ondelete='cascade')
    employee_id = fields.Many2one('hr.employee', required=True, ondelete='cascade')
    project_id = fields.Many2one('project.project', required=True, ondelete='cascade')
    task_id = fields.Many2one('project.task', ondelete='cascade')
    timesheet_ids = fields.Many2many('account.analytic.line', string="Timesheets")
    validate = fields.Boolean(default=True, help="Validate this employee's timesheet")
