# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from datetime import date, datetime, time
from collections import Counter


class HrContract(models.Model):
    _inherit = 'hr.contract'
    _description = 'Employee Contract'

    structure_type_id = fields.Many2one('hr.payroll.structure.type', string="Salary Structure Type")
    schedule_pay = fields.Selection([
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('semi-annually', 'Semi-annually'),
        ('annually', 'Annually'),
        ('weekly', 'Weekly'),
        ('bi-weekly', 'Bi-weekly'),
        ('bi-monthly', 'Bi-monthly'),
    ], string='Scheduled Pay', index=True, default='monthly',
    help="Defines the frequency of the wage payment.")
    resource_calendar_id = fields.Many2one(required=True, help="Employee's working schedule.")
    hours_per_week = fields.Float(related='resource_calendar_id.hours_per_week')
    full_time_required_hours = fields.Float(related='resource_calendar_id.full_time_required_hours')
    is_fulltime = fields.Boolean(related='resource_calendar_id.is_fulltime')

    @api.constrains('date_start', 'date_end', 'state')
    def _check_contracts(self):
        self._get_leaves()._check_contracts()

    @api.onchange('structure_type_id')
    def _onchange_structure_type_id(self):
        if self.structure_type_id.default_schedule_pay:
            self.schedule_pay = self.structure_type_id.default_schedule_pay
        if self.structure_type_id.default_resource_calendar_id:
            self.resource_calendar_id = self.structure_type_id.default_resource_calendar_id

    @api.multi
    def _get_leaves(self):
        return self.env['hr.leave'].search([
            ('employee_id', 'in', self.mapped('employee_id.id')),
            ('date_from', '<=', max([end or date.max for end in self.mapped('date_end')])),
            ('date_to', '>=', min(self.mapped('date_start'))),
        ])

    def _get_average_wage_per_day(self):
        self.ensure_one()
        work_days_per_week = len(set(self.resource_calendar_id._get_global_attendances().mapped('dayofweek')))
        return self.wage * 3 / 13 / work_days_per_week if work_days_per_week else 0.0  # there are always 13 weeks in 3 months

    @api.multi
    def _get_work_data(self, work_entry_types, date_from, date_to):
        """
        Returns the amount (expressed in days and hours) of work
        for a contract between two dates. Only work for the provided
        types are counted.
        If called on multiplie contracts, sum work amounts of each contract.
        :returns: a dict {'days': n, 'hours': h}
        """
        work_counter = Counter(days=0, hours=0)

        for contract in self:
            start = datetime.combine(max(date_from, contract.date_start), time.min)
            end = datetime.combine(min(date_to, contract.date_end or date.max), time.max)
            calendar = contract.resource_calendar_id

            contract_data = contract.employee_id._get_work_entry_days_data(work_entry_types, start, end, calendar=calendar)
            hours = contract_data.get('hours', 0)
            days = hours / calendar.hours_per_day if calendar.hours_per_day else 0  # n_days returned by work_entry_days_data doesn't make sense for extra work

            work_counter.update(Counter(days=days, hours=hours))
        return dict(work_counter)
