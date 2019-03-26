# # -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, date

from odoo.addons.hr_payroll.tests.common import TestPayslipContractBase


class TestPayslipComputation(TestPayslipContractBase):

    def setUp(self):
        super(TestPayslipComputation, self).setUp()

        self.richard_payslip = self.env['hr.payslip'].create({
            'name': 'Payslip of Richard',
            'employee_id': self.richard_emp.id,
            'contract_id': self.contract_cdi.id,  # wage = 5000 => average/day (over 3months/13weeks): 230.77
            'struct_id': self.developer_pay_structure.id,
            'date_from': date(2016, 1, 1),
            'date_to': date(2016, 1, 31)
        })
        self.richard_emp.resource_calendar_id = self.contract_cdi.resource_calendar_id

    def test_work_data(self):
        self.create_calendar_leave(datetime(2015, 11, 8, 8, 0), datetime(2015, 11, 10, 22, 0), self.work_entry_type_leave, calendar=self.contract_cdd.resource_calendar_id)
        self.create_calendar_leave(datetime(2015, 11, 13), datetime(2015, 11, 14), self.work_entry_type_leave, calendar=self.contract_cdi.resource_calendar_id)  # should not count (not the calendar of current contract)
        data = (self.contract_cdd | self.contract_cdi)._get_work_data(self.env.ref('hr_payroll.work_entry_type_attendance'), date(2015, 11, 10), date(2015, 11, 20))  # across two contracts

        self.assertEqual(data['days'], 8, 'It should count 8 attendance days')  # 5 first contract (-2 leave) + 5 second contract
        self.assertEqual(data['hours'], 59, 'It should count 59 attendance hours')  # 24h first contract + 35h second contract

    def test_unpaid_amount(self):
        self.assertEqual(self.richard_payslip.unpaid_amount, 0, "It should be paid the full wage")

        self.create_calendar_leave(date(2016, 1, 11), date(2016, 1, 12), self.work_entry_type_unpaid)
        self.richard_payslip.onchange_employee()
        self.assertEqual(self.richard_payslip.unpaid_amount, 230.77, "It should be paid 230.77 less")

    def test_worked_days_amount(self):

        self.create_calendar_leave(date(2016, 1, 11), date(2016, 1, 12), self.work_entry_type_leave)

        # works 9h on Fridays
        # => works 157 hours in the month, equivalent to 22.42 days of 7h
        self.env['resource.calendar.attendance'].create({
            'name': 'Extra work',
            'dayofweek': '4',
            'hour_from': 8.0,
            'hour_to': 17.0,
            'resource_id': self.richard_emp.resource_id.id,
            'calendar_id': self.contract_cdi.resource_calendar_id.id,
            'work_entry_type_id': self.work_entry_type.id,
        })

        self.richard_payslip.onchange_employee()
        work_days = self.richard_payslip.worked_days_line_ids

        self.assertEqual(sum(work_days.mapped('amount')), self.contract_cdi.wage, "The sum of all paid line should equal the wage")

        leave_line = work_days.filtered(lambda l: l.code == self.work_entry_type_leave.code)
        self.assertEqual(leave_line.amount, 222.93)

        extra_attendance_line = work_days.filtered(lambda l: l.code == self.work_entry_type.code)
        self.assertEqual(extra_attendance_line.amount, 1433.12)

        attendance_line = work_days.filtered(lambda l: l.code == self.env.ref('hr_payroll.work_entry_type_attendance').code)
        self.assertEqual(attendance_line.amount, 3343.95)

    def test_worked_days_amount_with_unpaid(self):

        self.create_calendar_leave(date(2016, 1, 11), date(2016, 1, 12), self.work_entry_type_leave)
        self.create_calendar_leave(date(2016, 1, 21), date(2016, 1, 22), self.work_entry_type_unpaid)

        self.richard_payslip.onchange_employee()
        work_days = self.richard_payslip.worked_days_line_ids

        self.assertAlmostEqual(sum(work_days.mapped('amount')), self.contract_cdi.wage - self.richard_payslip.unpaid_amount)

        leave_line = work_days.filtered(lambda l: l.code == self.work_entry_type_leave.code)
        self.assertEqual(leave_line.amount, 238.46)

        extra_attendance_line = work_days.filtered(lambda l: l.code == self.work_entry_type_unpaid.code)
        self.assertEqual(extra_attendance_line.amount, 0.0)

        attendance_line = work_days.filtered(lambda l: l.code == self.env.ref('hr_payroll.work_entry_type_attendance').code)
        self.assertEqual(attendance_line.amount, 4530.77)
