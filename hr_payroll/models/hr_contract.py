# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from collections import defaultdict
from odoo import api, fields, models
from odoo.tools import date_utils


class HrContract(models.Model):
    _inherit = 'hr.contract'
    _description = 'Employee Contract'

    structure_type_id = fields.Many2one('hr.payroll.structure.type', string="Salary Structure Type")
    schedule_pay = fields.Selection(related='structure_type_id.default_struct_id.schedule_pay', depends=())
    resource_calendar_id = fields.Many2one(required=True, default=lambda self: self.env.company.resource_calendar_id,
        help="Employee's working schedule.")
    hours_per_week = fields.Float(related='resource_calendar_id.hours_per_week')
    full_time_required_hours = fields.Float(related='resource_calendar_id.full_time_required_hours')
    is_fulltime = fields.Boolean(related='resource_calendar_id.is_fulltime')
    wage_type = fields.Selection(related='structure_type_id.wage_type')
    hourly_wage = fields.Monetary('Hourly Wage', digits=(16, 2), default=0, required=True, tracking=True, help="Employee's hourly gross wage.")

    company_country_id = fields.Many2one('res.country', string="Company country", related='company_id.country_id', readonly=True)

    @api.onchange('structure_type_id')
    def _onchange_structure_type_id(self):
        if self.structure_type_id.default_resource_calendar_id:
            self.resource_calendar_id = self.structure_type_id.default_resource_calendar_id

    @api.onchange('company_id')
    def _onchange_company_id(self):
        if self.company_id:
            structure_types = self.env['hr.payroll.structure.type'].search([
                '|',
                ('country_id', '=', self.company_id.country_id.id),
                ('country_id', '=', False)])
            if structure_types:
                self.structure_type_id = structure_types[0]
            elif self.structure_type_id not in structure_types:
                self.structure_type_id = False

    def _index_contracts(self):
        action = self.env.ref('hr_payroll.action_hr_payroll_index').read()[0]
        action['context'] = repr(self.env.context)
        return action

    def _get_work_hours(self, date_from, date_to):
        """
        Returns the amount (expressed in hours) of work
        for a contract between two dates.
        If called on multiple contracts, sum work amounts of each contract.
        :param date_from: The start date
        :param date_to: The end date
        :returns: a dictionary {work_entry_id: hours_1, work_entry_2: hours_2}
        """

        generated_date_max = min(fields.Date.to_date(date_to), date_utils.end_of(fields.Date.today(), 'month'))
        self._generate_work_entries(date_from, generated_date_max)
        date_from = datetime.combine(date_from, datetime.min.time())
        date_to = datetime.combine(date_to, datetime.max.time())
        work_data = defaultdict(int)

        # First, found work entry that didn't exceed interval.
        work_entries = self.env['hr.work.entry'].read_group(
            [
                ('state', 'in', ['validated', 'draft']),
                ('date_start', '>=', date_from),
                ('date_stop', '<=', date_to),
                ('contract_id', 'in', self.ids),
            ],
            ['hours:sum(duration)'],
            ['work_entry_type_id']
        )
        work_data.update({data['work_entry_type_id'][0] if data['work_entry_type_id'] else False: data['hours'] for data in work_entries})

        # Second, found work entry that exceed interval and compute right duration.
        work_entries = self.env['hr.work.entry'].search(
            [
                '&', '&',
                ('state', 'in', ['validated', 'draft']),
                ('contract_id', 'in', self.ids),
                '|', '|', '&', '&',
                ('date_start', '>=', date_from),
                ('date_start', '<', date_to),
                ('date_stop', '>', date_to),
                '&', '&',
                ('date_start', '<', date_from),
                ('date_stop', '<=', date_to),
                ('date_stop', '>', date_from),
                '&',
                ('date_start', '<', date_from),
                ('date_stop', '>', date_to),
            ]
        )

        for work_entry in work_entries:
            date_start = max(date_from, work_entry.date_start)
            date_stop = min(date_to, work_entry.date_stop)
            if work_entry.work_entry_type_id.is_leave:
                contract = work_entry.contract_id
                calendar = contract.resource_calendar_id
                contract_data = contract.employee_id._get_work_days_data(date_start, date_stop, compute_leaves=False, calendar=calendar)

                work_data[work_entry.work_entry_type_id.id] += contract_data.get('hours', 0)
            else:
                dt = date_stop - date_start
                work_data[work_entry.work_entry_type_id.id] += dt.days * 24 + dt.seconds / 3600  # Number of hours
        return work_data

    def _get_default_work_entry_type(self):
        return self.structure_type_id.default_work_entry_type_id or super(HrContract, self)._get_default_work_entry_type()
