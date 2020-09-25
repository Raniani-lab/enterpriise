# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date
from dateutil.relativedelta import relativedelta
from dateutil.rrule import rrule, DAILY

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class HrPayrollAllocPaidLeave(models.TransientModel):
    _name = 'hr.payroll.alloc.paid.leave'
    _description = 'Manage the Allocation of Paid Time Off'

    @api.model
    def default_get(self, field_list=None):
        if self.env.company.country_id.code != "BE":
            raise UserError(_('You must be logged in a Belgian company to use this feature'))
        return super().default_get(field_list)

    def _get_range_of_years(self):
        current_year = fields.Date.today().year
        return [(year, year) for year in range(current_year - 5, current_year + 1)]

    year = fields.Selection(string='Reference Period', selection='_get_range_of_years', required=True, help="Year of the period to consider", default=lambda self: fields.Date.today().year)
    structure_type_id = fields.Many2one('hr.payroll.structure.type', string="Structure Type")

    alloc_employee_ids = fields.One2many('hr.payroll.alloc.employee', 'alloc_paid_leave_id')

    holiday_status_id = fields.Many2one(
        "hr.leave.type", string="Time Off Type", required=True,
        domain=[('valid', '=', True), ('allocation_type', '!=', 'no')])

    company_id = fields.Many2one(
        'res.company', string='Company', required=True, default=lambda self: self.env.company)
    department_id = fields.Many2one('hr.department', 'Department', domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]")

    @api.onchange('structure_type_id', 'year', 'holiday_status_id', 'department_id')
    def _onchange_struct_id(self):
        if not self.env.user.has_group('hr_payroll.group_hr_payroll_user'):
            raise UserError(_("You don't have the right to do this. Please contact your administrator!"))
        self.alloc_employee_ids = False
        if not self.year or not self.company_id or not self.holiday_status_id:
            return

        period_start = date(int(self.year), 1, 1)
        period_end = date(int(self.year), 12, 31)

        business_day = len(list(rrule(DAILY, dtstart=period_start, until=period_end, byweekday=[0, 1, 2, 3, 4, 5])))

        if self.structure_type_id:
            structure = "structure_type_id = %(structure)s AND"
        else:
            structure = ""

        employee_in_department = ""
        if self.department_id:
            employee_in_department = "AND employee_id IN (SELECT id FROM hr_employee WHERE department_id = %(department)s)"

        query = """
            SELECT contract_id, employee_id, work_time_rate, date_start, date_end, resource_calendar_id
            FROM (
                SELECT contract.id as contract_id, contract.employee_id as employee_id, resource_calendar_id, work_time_rate, contract.date_start, contract.date_end
                FROM
                    (SELECT id, employee_id, resource_calendar_id, work_time_rate, date_start, date_end FROM hr_contract
                        WHERE
                            {where_structure}
                            employee_id IS NOT NULL
                            AND state IN ('open', 'pending', 'close')
                            AND date_start <= %(stop)s
                            AND (date_end IS NULL OR date_end >= %(start)s)
                            AND company_id IN %(company)s
                            {where_employee_in_department}
                    ) contract
                LEFT JOIN resource_calendar calendar ON (contract.resource_calendar_id = calendar.id)
            ) payslip
        """.format(where_structure=structure, where_employee_in_department=employee_in_department)

        self.env.cr.execute(query, {
            'start': fields.Date.to_string(period_start),
            'stop': fields.Date.to_string(period_end),
            'structure': self.structure_type_id.id,
            'company': tuple(self.env.companies.ids),
            'department': self.department_id.id
        })

        alloc_employees = {}  # key = employee_id and value contains paid_time_off and contract_id in Tuple
        legal_leaves = 20
        for vals in self.env.cr.dictfetchall():
            paid_time_off = 0
            contract_id = None

            if vals['employee_id'] in alloc_employees:
                paid_time_off, contract_id = alloc_employees[vals['employee_id']]

            date_start = vals['date_start']
            date_end = vals['date_end']
            calendar = self.env['resource.calendar'].browse(vals['resource_calendar_id'])
            work_time_rate = (calendar.work_time_rate / 100) * (float(vals['work_time_rate']) if vals['work_time_rate'] else 1.0)

            if date_start < period_start:
                date_start = period_start
            if date_end is None or date_end > period_end:
                if date_end is None:
                    contract_id = vals['contract_id']
                date_end = period_end

            business_day_for_period = len(list(rrule(DAILY, dtstart=date_start, until=date_end, byweekday=[0, 1, 2, 3, 4, 5])))
            paid_time_off += business_day_for_period / business_day * work_time_rate * legal_leaves

            alloc_employees[vals['employee_id']] = (paid_time_off, contract_id)

        alloc_employee_ids = []

        for employee_id, value in alloc_employees.items():
            paid_time_off, contract_next_period = value
            paid_time_off_to_allocate = 0
            if contract_next_period is None:
                next_period_start = period_start + relativedelta(years=1)
                next_period_end = period_end + relativedelta(years=1)
                domains = [
                    ('employee_id', '=', employee_id),
                    ('company_id', 'in', tuple(self.env.companies.ids)),
                    ('date_start', '<=', next_period_end),
                    '|',
                        ('date_end', '=', False),
                        ('date_end', '>=', next_period_start),
                    '|',
                        ('state', 'in', ('open', 'pending')),
                        '&',  # domain to seach state = 'incoming'
                            ('state', '=', 'draft'),
                            ('kanban_state', '=', 'done')
                ]
                if self.structure_type_id:
                    domains.append(('structure_type_id', '=', self.structure_type_id.id))
                contract_next_period = self.env['hr.contract'].search(domains, limit=1, order='date_start desc')  # We need the contract currently active for the next period for each employee to allocate the correct time off based on this contract.
            else:
                contract_next_period = self.env['hr.contract'].browse(contract_next_period)

            if contract_next_period.id:
                work_time_rate = (contract_next_period.resource_calendar_id.work_time_rate / 100) * (float(contract_next_period.work_time_rate) if contract_next_period.work_time_rate else 1.0)
                paid_time_off_to_allocate = legal_leaves * work_time_rate
                paid_time_off_to_allocate = round(paid_time_off_to_allocate * 2) / 2  # round the paid time off until x.5

            paid_time_off = round(paid_time_off * 2) / 2  # round the paid time off until x.5

            alloc_employee_ids.append((0, 0, {
                'employee_id': employee_id,
                'paid_time_off': paid_time_off,
                'paid_time_off_to_allocate': paid_time_off_to_allocate if paid_time_off_to_allocate <= paid_time_off else paid_time_off,
                'contract_next_year': contract_next_period.id,
                'alloc_paid_leave_id': self.id}))

        self.alloc_employee_ids = alloc_employee_ids

    def generate_allocation(self):
        allocation_values = []
        for alloc in self.alloc_employee_ids.filtered(lambda alloc: alloc.paid_time_off_to_allocate):
            allocation_values.append({
                'name': _('Paid Time Off Allocation'),
                'holiday_status_id': self.holiday_status_id.id,
                'employee_id': alloc.employee_id.id,
                'number_of_days': alloc.paid_time_off_to_allocate,
                'max_leaves_allocated': alloc.paid_time_off})
        allocations = self.env['hr.leave.allocation'].create(allocation_values)

        return {
            'name': 'Paid Time Off Allocation',
            'domain': [('id', 'in', allocations.ids)],
            'res_model': 'hr.leave.allocation',
            'view_id': False,
            'view_mode': 'tree,form',
            'type': 'ir.actions.act_window',
        }


class HrPayrollAllocEmployee(models.TransientModel):
    _name = 'hr.payroll.alloc.employee'
    _description = 'Manage the Allocation of Paid Time Off Employee'

    employee_id = fields.Many2one('hr.employee', string="Employee", required=True)
    paid_time_off = fields.Float("Paid Time Off For The Period", required=True)
    paid_time_off_to_allocate = fields.Float("Paid Time Off To Allocate", required=True)
    contract_next_year_id = fields.Many2one('hr.contract', string="Contract Active Next Year")
    current_working_schedule = fields.Char(compute='_compute_current_working_schedule', string="Current Working Schedule", readonly=True)

    alloc_paid_leave_id = fields.Many2one('hr.payroll.alloc.paid.leave')

    def _compute_current_working_schedule(self):
        for payroll_alloc_employee in self:
            if payroll_alloc_employee.contract_next_year.id:
                payroll_alloc_employee.current_working_schedule = '%s - %s' % (payroll_alloc_employee.contract_next_year.resource_calendar_id.name, _('Full Time') if not payroll_alloc_employee.contract_next_year.work_time_rate or payroll_alloc_employee.contract_next_year.work_time_rate == '0' else payroll_alloc_employee.contract_next_year.work_time_rate)
            else:
                payroll_alloc_employee.current_working_schedule = ''
