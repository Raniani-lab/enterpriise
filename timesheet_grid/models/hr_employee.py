# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, time, timedelta
from pytz import UTC

from odoo import api, fields, models
from odoo.tools import float_round
from odoo.addons.resource.models.utils import sum_intervals


class Employee(models.Model):
    _inherit = 'hr.employee'

    def _get_employees_working_hours(self, employees, start_datetime, end_datetime):

        # find working hours for the given period of employees with working calendar
        # Note: convert date str into datetime object. Time will be 00:00:00 and 23:59:59
        # respectively for date_start and date_stop, because we want the date_stop to be included.
        start_datetime = datetime.combine(fields.Date.from_string(start_datetime), time.min)
        end_datetime = datetime.combine(fields.Date.from_string(end_datetime), time.max)
        start_datetime = start_datetime.replace(tzinfo=UTC)
        end_datetime = end_datetime.replace(tzinfo=UTC)

        employees_work_days_data, _dummy = employees.sudo().resource_id._get_valid_work_intervals(start_datetime, end_datetime)

        return employees_work_days_data

    def _get_timesheet_manager_id_domain(self):
        group = self.env.ref('hr_timesheet.group_hr_timesheet_approver', raise_if_not_found=False)
        return [('groups_id', 'in', [group.id])] if group else []

    timesheet_manager_id = fields.Many2one(
        'res.users', string='Timesheet',
        compute='_compute_timesheet_manager', store=True, readonly=False,
        domain=_get_timesheet_manager_id_domain,
        help='Select the user responsible for approving "Timesheet" of this employee.\n'
             'If empty, the approval is done by a Timesheets > Administrator or a Timesheets > User: all timesheets (as determined in the users settings).')

    last_validated_timesheet_date = fields.Date(groups="hr_timesheet.group_timesheet_manager")

    @api.depends('parent_id')
    def _compute_timesheet_manager(self):
        for employee in self:
            previous_manager = employee._origin.parent_id.user_id
            manager = employee.parent_id.user_id
            if manager and manager.has_group('hr_timesheet.group_hr_timesheet_approver') and (employee.timesheet_manager_id == previous_manager or not employee.timesheet_manager_id):
                employee.timesheet_manager_id = manager
            elif not employee.timesheet_manager_id:
                employee.timesheet_manager_id = False

    def get_timesheet_and_working_hours(self, date_start, date_stop):
        """ Get the difference between the supposed working hour (based on resource calendar) and
            the timesheeted hours, for the given period `date_start` - `date_stop` (inclusives).
            :param date_start : start date of the period to check (date string)
            :param date_stop : end date of the period to check (date string)
            :returns dict : a dict mapping the employee_id with his timesheeted and working hours for the
                given period.
        """
        employees = self.filtered(lambda emp: emp.resource_calendar_id)
        result = {i: dict(timesheet_hours=0.0, working_hours=0.0, date_start=date_start, date_stop=date_stop) for i in self.ids}
        if not employees:
            return result

        # find timesheeted hours of employees with working hours
        self.env.cr.execute("""
            SELECT A.employee_id as employee_id, sum(A.unit_amount) as amount_sum
            FROM account_analytic_line A
            WHERE A.employee_id IN %s AND date >= %s AND date <= %s
            GROUP BY A.employee_id
        """, (tuple(employees.ids), date_start, date_stop))
        for data_row in self.env.cr.dictfetchall():
            result[data_row['employee_id']]['timesheet_hours'] = float_round(data_row['amount_sum'], 2)


        employees_work_days_data = self._get_employees_working_hours(employees, date_start, date_stop)
        for employee in employees:
            working_hours = sum_intervals(employees_work_days_data[employee.resource_id.id])
            result[employee.id]['working_hours'] = float_round(working_hours, 2)
        return result

    @api.model
    def get_daily_working_hours(self, date_start, date_stop):
        result = {}
        # Change the type of the date from string to Date
        date_start_date = fields.Date.from_string(date_start)
        date_stop_date = fields.Date.from_string(date_stop)

        # Compute the difference between the starting and ending date
        delta = date_stop_date - date_start_date

        # Get the current user
        current_employee = self.env.user.employee_id

        # Change the type of the date from date to datetime and add UTC as the timezone time standard
        datetime_min = datetime.combine(date_start_date, time.min).replace(tzinfo=UTC)
        datetime_max = datetime.combine(date_stop_date, time.max).replace(tzinfo=UTC)
        # Collect the number of hours that an employee should work according to their schedule
        employee_work_days_data = current_employee.resource_calendar_id._work_intervals_batch(
            datetime_min, datetime_max,
            resources=current_employee.resource_id, compute_leaves=False
        )
        working_hours = employee_work_days_data[current_employee.resource_id.id]

        for day_count in range(delta.days + 1):
            date = date_start_date + timedelta(days=day_count)
            value = sum(
                (stop - start).total_seconds() / 3600
                for start, stop, meta in working_hours
                if start.date() == date
            )

            result[day_count] = {
                'date': fields.Date.to_string(date),
                'total_hours': value,
            }

        return result

    def _get_timesheets_and_working_hours_query(self):
        return """
            SELECT aal.employee_id as employee_id, COALESCE(SUM(aal.unit_amount), 0) as worked_hours
            FROM account_analytic_line aal
            WHERE aal.employee_id IN %s AND date >= %s AND date <= %s
            GROUP BY aal.employee_id
        """

    @api.model
    def get_timesheet_and_working_hours_for_employees(self, employees_grid_data, date_start, date_stop):
        """
        Method called by the timesheet avatar widget on the frontend in gridview to get information
        about the hours employees have worked and should work.

        :return: Dictionary of dictionary
                 for each employee id =>
                     number of units to work,
                     what unit type are we using
                     the number of worked units by the employees
        """
        result = {}

        uom = str(self.env.company.timesheet_encode_uom_id.name).lower()

        employee_ids = [employee_data['id'] for employee_data in employees_grid_data if 'id' in employee_data]
        employees = self.env['hr.employee'].browse(employee_ids)
        hours_per_day_per_employee = {}

        employees_work_days_data = self._get_employees_working_hours(employees, date_start, date_stop)

        for employee in employees:
            units_to_work = sum_intervals(employees_work_days_data[employee.resource_id.id])

            # Adjustments if we work with a different unit of measure
            if uom == 'days':
                hours_per_day_per_employee[employee.id] = employee.resource_calendar_id.hours_per_day
                units_to_work = units_to_work / hours_per_day_per_employee[employee.id]
                rounding = len(str(self.env.company.timesheet_encode_uom_id.rounding).split('.')[1])
                units_to_work = round(units_to_work, rounding)
            result[employee.id] = {'units_to_work': units_to_work, 'uom': uom, 'worked_hours': 0.0}

        query = self._get_timesheets_and_working_hours_query()
        self.env.cr.execute(query, (tuple(employee_ids), date_start, date_stop))

        for data_row in self.env.cr.dictfetchall():

            worked_hours = data_row['worked_hours']

            if uom == 'days':
                worked_hours /= hours_per_day_per_employee[data_row['employee_id']]
                rounding = len(str(self.env.company.timesheet_encode_uom_id.rounding).split('.')[1])
                worked_hours = round(worked_hours, rounding)

            result[data_row['employee_id']]['worked_hours'] = worked_hours

        return result

    def _get_user_m2o_to_empty_on_archived_employees(self):
        return super()._get_user_m2o_to_empty_on_archived_employees() + ['timesheet_manager_id']

    def action_timesheet_from_employee(self):
        action = super().action_timesheet_from_employee()
        action['context']['group_expand'] = True
        return action


class HrEmployeePublic(models.Model):
    _inherit = 'hr.employee.public'

    timesheet_manager_id = fields.Many2one('res.users', string='Timesheet',
        help="User responsible of timesheet validation. Should be Timesheet Manager.")
