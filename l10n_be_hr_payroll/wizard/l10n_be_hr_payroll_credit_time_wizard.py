# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta


from odoo import api, fields, models, _
from odoo.tools import float_round
from odoo.exceptions import UserError, ValidationError


class L10nBeHrPayrollCreditTime(models.TransientModel):
    _name = 'l10n_be.hr.payroll.credit.time.wizard'
    _description = 'Manage Belgian Credit Time'

    @api.model
    def default_get(self, field_list):
        if self.env.company.country_id.code != "BE":
            raise UserError(_('You must be logged in a Belgian company to use this feature'))
        return super().default_get(field_list)

    contract_id = fields.Many2one('hr.contract', string='Contract', default=lambda self: self.env.context.get('active_id'))
    company_id = fields.Many2one(related="contract_id.company_id", readonly=True)
    employee_id = fields.Many2one(related='contract_id.employee_id')
    date_start = fields.Date('Start Date', help="Start date of the credit time contract.", required=True)
    date_end = fields.Date('End Date', required=True,
        help="Last day included of the credit time contract.")

    resource_calendar_id = fields.Many2one(
        'resource.calendar', 'New Working Schedule', required=True,
        default=lambda self: self.env.company.resource_calendar_id.id,
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]")
    wage = fields.Monetary(
        compute='_compute_wage', store=True, readonly=False,
        string='New Wage', required=True,
        help="Employee's monthly gross wage in credit time.")
    currency_id = fields.Many2one(string="Currency", related='company_id.currency_id', readonly=True)

    work_time = fields.Float(related="resource_calendar_id.work_time_rate", readonly=True)
    time_off_allocation = fields.Float(string='New Time Off Allocation', compute='_compute_paid_time_off', store=True, readonly=False)
    remaining_allocated_time_off = fields.Float(string='Current Remaining Leaves', compute='_compute_paid_time_off', store=True, readonly=True)
    holiday_status_id = fields.Many2one(
        "hr.leave.type", string="Time Off Type", required=True,
        domain=[('valid', '=', True), ('allocation_type', '!=', 'no')])
    leave_allocation_id = fields.Many2one('hr.leave.allocation')

    @api.depends('work_time')
    def _compute_wage(self):
        for wizard in self:
            wizard.wage = wizard.contract_id._get_contract_wage() * float(wizard.work_time) / 100  # TODO: [XBO] remove "/ 100" when work_time is a fraction instead of a percentage.

    @api.depends('holiday_status_id', 'work_time', 'resource_calendar_id')
    def _compute_paid_time_off(self):
        for wizard in self:
            if not wizard.holiday_status_id.id or not wizard.work_time:
                continue

            # Normally, it should only have an allocation for each employee per year
            leave_allocation = self.env['hr.leave.allocation'].search([
                ('holiday_status_id', '=', wizard.holiday_status_id.id),
                ('employee_id', '=', wizard.contract_id.employee_id.id),
                ('state', 'in', ('validate', 'validate1'))], limit=1)
            if not leave_allocation.id:
                continue

            default_calendar = self.company_id.resource_calendar_id

            # Compute the number of hours if the employee had the new working schedule last year
            leaves_to_allocate = 20 * default_calendar.hours_per_day * wizard.work_time / 100

            if leave_allocation.max_leaves_allocated < leaves_to_allocate:
                # Then we need to reduce the number of hours to the max_leaves_allocated
                leaves_to_allocate = leave_allocation.max_leaves_allocated

            # Convert hours in days
            leaves_to_allocate /= wizard.resource_calendar_id.hours_per_day

            if leaves_to_allocate > 20:
                leaves_to_allocate = 20

            # Reduce the number of days by the number of leaves taken and round the result
            time_off_allocation = float_round(leaves_to_allocate - leave_allocation.leaves_taken, 0)

            wizard.write({
                'time_off_allocation': time_off_allocation,
                'remaining_allocated_time_off': leave_allocation.number_of_days - leave_allocation.leaves_taken,
                'leave_allocation_id': leave_allocation.id
            })

    def validate_credit_time(self):
        if self.date_start > self.date_end:
            raise ValidationError(_('Start date must be earlier than end date.'))
        if self.contract_id.date_end and self.contract_id.date_end < self.date_start:
            raise ValidationError(_('Current contract is finished before the start of credit time period.'))
        if self.contract_id.date_end and self.contract_id.date_end < self.date_end:
            raise ValidationError(_('Current contract is finished before the end of credit time period.'))

        credit_time_contract = self.contract_id.copy({
            'name': _('%s - Credit Time %.0f%%') % (self.contract_id.name, self.work_time),  # TODO: [XBO] replace %.0f%% by %s when work_time is like this 4/5, 1/2 or 9/10 instead of a percentage.
            'date_start': self.date_start,
            'date_end': self.date_end,
            self.contract_id._get_contract_wage_field(): self.wage,
            'time_credit_full_time_wage': self.wage / (self.work_time / 100) if self.work_time != 0 else self.contract_id._get_contract_wage(),
            'resource_calendar_id': self.resource_calendar_id.id,
            'standard_calendar_id': self.contract_id.resource_calendar_id.id,
            'time_credit': True,
            'work_time_rate': self.work_time / 100,
            'state': 'draft',
        })

        if self.leave_allocation_id:
            # Update the number of days to allocate for the current year
            self.leave_allocation_id.update({'number_of_days': self.time_off_allocation + self.leave_allocation_id.leaves_taken})

        self.contract_id.date_end = self.date_start + timedelta(days=-1)

        return {
            'name': _('Credit time contract'),
            'domain': [('id', 'in', [credit_time_contract.id, self.contract_id.id])],
            'res_model': 'hr.contract',
            'view_id': False,
            'view_mode': 'tree,form',
            'type': 'ir.actions.act_window',
        }


class L10nBeHrPayrollExitCreditTime(models.TransientModel):
    _name = 'l10n_be.hr.payroll.exit.credit.time.wizard'
    _description = 'Manage Belgian Exit Credit Time'

    @api.model
    def default_get(self, field_list):
        if self.env.company.country_id.code != "BE":
            raise UserError(_('You must be logged in a Belgian company to use this feature'))
        res = super(L10nBeHrPayrollExitCreditTime, self).default_get(field_list)
        current_credit_time = self.env['hr.contract'].browse(self.env.context.get('active_id'))
        res['contract_id'] = current_credit_time.id
        res['resource_calendar_id'] = current_credit_time.standard_calendar_id.id
        res['wage'] = current_credit_time.time_credit_full_time_wage
        res['date_start'] = current_credit_time.date_end + timedelta(days=1)
        return res

    credit_time_contract_id = fields.Many2one('hr.contract', string='Credit Time Contract', default=lambda self: self.env.context.get('active_id'))
    contract_id = fields.Many2one('hr.contract', string='Contract')
    employee_id = fields.Many2one(related='credit_time_contract_id.employee_id')
    company_id = fields.Many2one(related="credit_time_contract_id.company_id", readonly=True)
    date_start = fields.Date('Start Date', help="Start date of the normal time contract.", required=True)
    date_end = fields.Date('End Date', help="End date of the normal time contract (if it's a fixed-term contract).")

    resource_calendar_id = fields.Many2one(
        'resource.calendar', 'New Working Schedule', required=True,
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]")
    wage = fields.Monetary('New Wage', required=True, help="Employee's monthly gross wage.")
    currency_id = fields.Many2one(string="Currency", related='company_id.currency_id', readonly=True)

    holiday_status_id = fields.Many2one(
        "hr.leave.type", string="Time Off Type", required=True,
        domain=[('valid', '=', True), ('allocation_type', '!=', 'no')])
    time_off_allocation = fields.Float('New Time Off Allocation', compute='_compute_paid_time_off', store=True, readonly=False)
    remaining_allocated_time_off = fields.Float('Current Remaining Leaves', compute='_compute_paid_time_off', store=True, readonly=True)
    holiday_status_id = fields.Many2one(
        "hr.leave.type", string="Time Off Type", required=True,
        domain=[('valid', '=', True), ('allocation_type', '!=', 'no')])
    leave_allocation_id = fields.Many2one('hr.leave.allocation')

    @api.depends('holiday_status_id', 'resource_calendar_id')
    def _compute_paid_time_off(self):
        for wizard in self:
            if not wizard.holiday_status_id.id or not wizard.resource_calendar_id.id:
                continue

            leave_allocation = wizard.env['hr.leave.allocation'].search([
                ('holiday_status_id', '=', wizard.holiday_status_id.id),
                ('employee_id', '=', wizard.contract_id.employee_id.id),
                ('state', 'in', ('validate', 'validate1'))], limit=1)
            if not leave_allocation.id:
                continue

            default_calendar = self.company_id.resource_calendar_id

            # Compute the number of hours if the employee had the new working schedule last year
            leaves_to_allocate = 20 * default_calendar.hours_per_day * wizard.resource_calendar_id.work_time_rate / 100

            if leave_allocation.max_leaves_allocated < leaves_to_allocate:
                # Then we need to reduce the number of hours to the max_leaves_allocated
                leaves_to_allocate = leave_allocation.max_leaves_allocated

            # Convert hours in days
            leaves_to_allocate /= wizard.resource_calendar_id.hours_per_day

            if leaves_to_allocate > 20:
                leaves_to_allocate = 20

            # Reduce the number of days by the number of leaves taken and round the result
            time_off_allocation = float_round(leaves_to_allocate - leave_allocation.leaves_taken, 0)

            wizard.write({
                'time_off_allocation': time_off_allocation,
                'remaining_allocated_time_off': leave_allocation.number_of_days - leave_allocation.leaves_taken,
                'leave_allocation_id': leave_allocation.id
            })

    def validate_full_time(self):
        if self.date_end and self.date_start > self.date_end:
            raise ValidationError(_('Start date must be earlier than end date.'))
        if self.date_start < self.credit_time_contract_id.date_end:
            raise ValidationError(_('Start date must be later than end date of credit time contract.'))

        full_time_contract = self.contract_id.copy({
            'date_start': self.date_start,
            'date_end': self.date_end,
            self.contract_id._get_contract_wage_field(): self.wage,
            'resource_calendar_id': self.resource_calendar_id.id,
            'time_credit': False,
            'work_time_rate': False,
            'state': 'draft',
        })

        if self.leave_allocation_id.id:
            # Update the number of days to allocate for the current year
            self.leave_allocation_id.update({'number_of_days': self.time_off_allocation + self.leave_allocation_id.leaves_taken})

        return {
            'name': _('Full time contract'),
            'res_id': full_time_contract.id,
            'res_model': 'hr.contract',
            'view_id': False,
            'view_mode': 'form',
            'type': 'ir.actions.act_window',
        }
