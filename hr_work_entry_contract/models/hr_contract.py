# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date, datetime
from odoo import api, fields, models

import pytz


class HrContract(models.Model):
    _inherit = 'hr.contract'
    _description = 'Employee Contract'

    date_generated_from = fields.Datetime(string='Generated From', readonly=True, required=True,
        default=lambda self: datetime.now().replace(hour=0, minute=0, second=0))
    date_generated_to = fields.Datetime(string='Generated To', readonly=True, required=True,
        default=lambda self: datetime.now().replace(hour=0, minute=0, second=0))

    def _get_default_work_entry_type(self):
        return self.env.ref('hr_work_entry.work_entry_type_attendance', raise_if_not_found=False)

    def _get_leave_work_entry_type(self, leave):
        return leave.work_entry_type_id

    # Is used to add more values, for example leave_id (in hr_work_entry_holidays)
    def _get_more_vals_leave(self, leave):
        return []

    def _get_contract_work_entries_values(self, date_start, date_stop, default_work_entry_type):
        contract_vals = []
        employee = self.employee_id
        calendar = self.resource_calendar_id
        resource = employee.resource_id
        tz = pytz.timezone(calendar.tz)

        attendances = calendar._work_intervals(
            pytz.utc.localize(date_start) if not date_start.tzinfo else date_start,
            pytz.utc.localize(date_stop) if not date_stop.tzinfo else date_stop,
            resource=resource, tz=tz
        )
        # Attendances
        for interval in attendances:
            work_entry_type_id = interval[2].mapped('work_entry_type_id')[:1] or default_work_entry_type
            # All benefits generated here are using datetimes converted from the employee's timezone
            contract_vals += [{
                'name': "%s: %s" % (work_entry_type_id.name, employee.name),
                'date_start': interval[0].astimezone(pytz.utc).replace(tzinfo=None),
                'date_stop': interval[1].astimezone(pytz.utc).replace(tzinfo=None),
                'work_entry_type_id': work_entry_type_id.id,
                'employee_id': employee.id,
                'contract_id': self.id,
                'company_id': self.company_id.id,
                'state': 'draft',
            }]
        return contract_vals

    def _get_contract_leave_entries_values(self, date_start, date_stop):
        contract_vals = []
        employee = self.employee_id
        calendar = self.resource_calendar_id
        resource = employee.resource_id
        leaves = self.env['resource.calendar.leaves'].sudo().search([
            ('resource_id', 'in', [False, resource.id]),
            ('calendar_id', '=', calendar.id),
            ('date_from', '<', date_stop),
            ('date_to', '>', date_start)
        ])

        for leave in leaves:
            start = max(leave.date_from, datetime.combine(self.date_start, datetime.min.time()))
            end = min(leave.date_to, datetime.combine(self.date_end or date.max, datetime.max.time()))
            leave_entry_type = self._get_leave_work_entry_type(leave)
            contract_vals += [dict([
                ('name', "%s%s" % (leave_entry_type.name + ": " if leave_entry_type else "", employee.name)),
                ('date_start', start),
                ('date_stop', end),
                ('work_entry_type_id', leave_entry_type.id),
                ('employee_id', employee.id),
                ('company_id', self.company_id.id),
                ('state', 'draft'),
                ('contract_id', self.id),
            ] + self._get_more_vals_leave(leave))]
        return contract_vals

    def _get_work_entries_values(self, date_start, date_stop):
        """
        Generate a work_entries list between date_start and date_stop for one contract.
        :return: list of dictionnary.
        """
        vals_list = []

        for contract in self:
            contract_vals = contract._get_contract_work_entries_values(date_start, date_stop, contract._get_default_work_entry_type())
            contract_vals += contract._get_contract_leave_entries_values(date_start, date_stop)

            # If we generate work_entries which exceeds date_start or date_stop, we change boundaries on contract
            if contract_vals:
                date_stop_max = max([x['date_stop'] for x in contract_vals])
                if date_stop_max > contract.date_generated_to:
                    contract.date_generated_to = date_stop_max

                date_start_min = min([x['date_start'] for x in contract_vals])
                if date_start_min < contract.date_generated_from:
                    contract.date_generated_from = date_start_min

            vals_list += contract_vals

        return vals_list

    def _generate_work_entries(self, date_start, date_stop):
        vals_list = []

        date_start = fields.Datetime.to_datetime(date_start)
        date_stop = datetime.combine(fields.Datetime.to_datetime(date_stop), datetime.max.time())

        for contract in self:
            # For each contract, we found each interval we must generate
            contract_start = fields.Datetime.to_datetime(contract.date_start)
            contract_stop = datetime.combine(fields.Datetime.to_datetime(contract.date_end or datetime.max.date()), datetime.max.time())
            last_generated_from = min(contract.date_generated_from, contract_stop)
            date_start_work_entries = max(date_start, contract_start)

            if last_generated_from > date_start_work_entries:
                contract.date_generated_from = date_start_work_entries
                vals_list.extend(contract._get_work_entries_values(date_start_work_entries, last_generated_from))

            last_generated_to = max(contract.date_generated_to, contract_start)
            date_stop_work_entries = min(date_stop, contract_stop)
            if last_generated_to < date_stop_work_entries:
                contract.date_generated_to = date_stop_work_entries
                vals_list.extend(contract._get_work_entries_values(last_generated_to, date_stop_work_entries))

        if not vals_list:
            return self.env['hr.work.entry']

        return self.env['hr.work.entry'].create(vals_list)
