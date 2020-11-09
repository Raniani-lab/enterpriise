# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date

from odoo.tests import tagged
from odoo.exceptions import ValidationError

from .common import TestPayrollCommon


@tagged('post_install', '-at_install', 'payroll_credit_time')
class TestPayrollCreditTime(TestPayrollCommon):

    def setUp(self):
        super(TestPayrollCreditTime, self).setUp()

        today = date.today()
        self.paid_time_off_type = self.holiday_leave_types.filtered(lambda leave_type: leave_type.validity_start == date(today.year, 1, 1) and leave_type.validity_stop == date(today.year, 12, 31))

        self.wizard = self.env['hr.payroll.alloc.paid.leave'].create({
            'year': today.year - 1,
            'holiday_status_id': self.paid_time_off_type.id
        })
        self.wizard._onchange_struct_id()
        self.wizard.alloc_employee_ids = self.wizard.alloc_employee_ids.filtered(lambda alloc_employee: alloc_employee.employee_id.id in [self.employee_georges.id, self.employee_john.id, self.employee_a.id])

        view = self.wizard.generate_allocation()
        self.allocations = self.env['hr.leave.allocation'].search(view['domain'])
        for allocation in self.allocations:
            allocation.action_validate()

    def test_credit_time_for_georges(self):
        """
        Test Case:
        The employee Georges asks a credit time to work at mid-time (3 days/week) from 01/02 to 30/04 in the current year,
        normally, he has 15 days before his credit and with the credit, the number of paid time off days dereases
        12 half days. If Georges didn't take some leaves during his credit, when he exists it, his number of paid time off
        days increase to the number maximum of allocated days that he can have.
        """
        current_year = date.today().year

        georges_current_contract = self.georges_contracts[-1]
        georges_allocation = self.allocations.filtered(lambda alloc: alloc.employee_id.id == self.employee_georges.id)

        # Test for employee Georges
        # Credit time for Georges
        wizard = self.env['l10n_be.hr.payroll.credit.time.wizard'].with_context(allowed_company_ids=self.belgian_company.ids, active_id=georges_current_contract.id).new({
            'date_start': date(current_year, 2, 1),
            'date_end': date(current_year, 4, 30),
            'resource_calendar_id': self.resource_calendar_mid_time.id,
            'holiday_status_id': self.paid_time_off_type.id,
        })
        self.assertEqual(wizard.time_off_allocation, 12)
        self.assertEqual(wizard.remaining_allocated_time_off, 15)
        self.assertAlmostEqual(wizard.work_time, 50, 2)
        view = wizard.validate_credit_time()
        credit_time_contract = self.env['hr.contract'].search(view['domain']).filtered(lambda contract: contract.id != georges_current_contract.id)

        # Exit credit time for Georges
        wizard = self.env['l10n_be.hr.payroll.exit.credit.time.wizard'].with_context(allowed_company_ids=self.belgian_company.ids, active_id=credit_time_contract.id).new({
            'date_start': date(current_year, 5, 1),
            'holiday_status_id': self.paid_time_off_type.id
        })
        self.assertEqual(wizard.time_off_allocation, 15)
        self.assertEqual(wizard.remaining_allocated_time_off, 12)
        view = wizard.validate_full_time()
        full_time_contract = self.env['hr.contract'].browse(view['res_id'])
        self.assertEqual(full_time_contract.time_credit, False)
        self.assertEqual(georges_allocation.number_of_days, wizard.time_off_allocation)

    def test_credit_time_for_john_doe(self):
        """
        Test Case:
        The employee John Doe asks a credit time to work at 9/10 from 01/02 to 30/04 in the current year.
        """
        current_year = date.today().year
        john_current_contract = self.john_contracts[-1]
        john_allocation = self.allocations.filtered(lambda alloc: alloc.employee_id.id == self.employee_john.id)

        # Test for employee John Doe
        # Credit time for John Doe
        wizard = self.env['l10n_be.hr.payroll.credit.time.wizard'].with_context(allowed_company_ids=self.belgian_company.ids, active_id=john_current_contract.id).new({
            'date_start': date(current_year, 2, 1),
            'date_end': date(current_year, 4, 30),
            'resource_calendar_id': self.resource_calendar_9_10.id,
            'holiday_status_id': self.paid_time_off_type.id,
        })
        self.assertEqual(wizard.time_off_allocation, 18, "it should be equal to 18 of 6.84 hours")
        self.assertEqual(wizard.remaining_allocated_time_off, 19)
        self.assertAlmostEqual(wizard.work_time, 90, 2)
        view = wizard.validate_credit_time()
        credit_time_contract = self.env['hr.contract'].search(view['domain']).filtered(lambda contract: contract.id != john_current_contract.id)

        # Exit credit time for John Doe
        wizard = self.env['l10n_be.hr.payroll.exit.credit.time.wizard'].with_context(allowed_company_ids=self.belgian_company.ids, active_id=credit_time_contract.id).new({
            'date_start': date(current_year, 5, 1),
            'holiday_status_id': self.paid_time_off_type.id,
            'resource_calendar_id': self.resource_calendar.id
        })
        self.assertEqual(wizard.time_off_allocation, 16)
        self.assertEqual(wizard.remaining_allocated_time_off, 18)
        view = wizard.validate_full_time()
        full_time_contract = self.env['hr.contract'].browse(view['res_id'])
        self.assertEqual(full_time_contract.time_credit, False)
        self.assertEqual(john_allocation.number_of_days, wizard.time_off_allocation)

    def test_credit_time_for_a(self):
        """
        Test Case:
        The employee A has a contract full-time from 01/01 of the previous year.
        Then, he has right to 20 complete days as paid time off.
        The employee A asks a credit time to work at 4/5 (4 days/week) from 01/02 to 30/04 in the current year.
        With this credit time, his number of paid time off days decrease to
        """
        current_year = date.today().year
        a_current_contract = self.a_contracts[-1]
        a_allocation = self.allocations.filtered(lambda alloc: alloc.employee_id.id == self.employee_a.id)
        self.assertEqual(a_allocation.number_of_days, 20)

        # Test for employee A
        # Credit time for A
        wizard = self.env['l10n_be.hr.payroll.credit.time.wizard'].with_context(allowed_company_ids=self.belgian_company.ids, active_id=a_current_contract.id).new({
            'date_start': date(current_year, 2, 1),
            'date_end': date(current_year, 4, 30),
            'resource_calendar_id': self.resource_calendar_4_5.id,
            'holiday_status_id': self.paid_time_off_type.id
        })
        self.assertEqual(wizard.time_off_allocation, 16)
        self.assertEqual(wizard.remaining_allocated_time_off, 20)
        self.assertAlmostEqual(wizard.work_time, 80, 2)
        view = wizard.validate_credit_time()
        credit_time_contract = self.env['hr.contract'].search(view['domain']).filtered(lambda contract: contract.id != a_current_contract.id)

        # Exit credit time for A
        wizard = self.env['l10n_be.hr.payroll.exit.credit.time.wizard'].with_context(allowed_company_ids=self.belgian_company.ids, active_id=credit_time_contract.id).new({
            'date_start': date(current_year, 5, 1),
            'holiday_status_id': self.paid_time_off_type.id
        })
        self.assertEqual(wizard.time_off_allocation, 20)
        self.assertEqual(wizard.remaining_allocated_time_off, 16)
        view = wizard.validate_full_time()
        full_time_contract = self.env['hr.contract'].browse(view['res_id'])
        self.assertEqual(full_time_contract.time_credit, False)
        self.assertEqual(a_allocation.number_of_days, wizard.time_off_allocation)

    def test_remaining_leaves_with_credit_time(self):
        """
        Test Case (only with the employee A)
        - Full Time from 01/01 to 31/05 and A took 6 days off (it remained 14 days)
        - 4/5 (4 days/week) from 01/06 to 31/08 and A took 6 days (it remained 5)
        - 1/2 (3 days/week) from 01/09 -> 31/12 (in this case, we need to do an exit credit to full time and then add a credit)
        """
        today = date.today()
        a_current_contract = self.a_contracts[-1]
        a_allocation = self.allocations.filtered(lambda alloc: alloc.employee_id.id == self.employee_a.id)

        leave = self.env['hr.leave'].create({
            'holiday_status_id': self.paid_time_off_type.id,
            'employee_id': self.employee_a.id,
            'request_date_from': date(today.year, 2, 1),
            'request_date_to': date(today.year, 2, 6),
            'number_of_days': 6
        })
        leave.action_validate()

        # Credit time
        wizard = self.env['l10n_be.hr.payroll.credit.time.wizard'].with_context(allowed_company_ids=self.belgian_company.ids, active_id=a_current_contract.id).new({
            'date_start': date(today.year, 6, 1),
            'date_end': date(today.year, 8, 31),
            'resource_calendar_id': self.resource_calendar_4_5.id,
            'holiday_status_id': self.paid_time_off_type.id
        })
        self.assertEqual(wizard.time_off_allocation, 10)
        self.assertEqual(wizard.remaining_allocated_time_off, 14)
        self.assertAlmostEqual(wizard.work_time, 80, 2)
        view = wizard.validate_credit_time()
        credit_time_contract = self.env['hr.contract'].search(view['domain']).filtered(lambda contract: contract.id != a_current_contract.id)

        leave = self.env['hr.leave'].create({
            'holiday_status_id': self.paid_time_off_type.id,
            'employee_id': self.employee_a.id,
            'request_date_from': date(today.year, 7, 1),
            'request_date_to': date(today.year, 7, 6),
            'number_of_days': 6
        })
        leave.action_validate()

        # Exit credit time
        wizard = self.env['l10n_be.hr.payroll.exit.credit.time.wizard'].with_context(allowed_company_ids=self.belgian_company.ids, active_id=credit_time_contract.id).new({
            'date_start': date(today.year, 9, 1),
            'holiday_status_id': self.paid_time_off_type.id
        })
        self.assertEqual(wizard.time_off_allocation, 8)
        self.assertEqual(wizard.remaining_allocated_time_off, 4)
        view = wizard.validate_full_time()
        full_time_contract = self.env['hr.contract'].browse(view['res_id'])
        self.assertEqual(full_time_contract.time_credit, False)
        self.assertEqual(a_allocation.number_of_days, 20, "6 remained paid time offs and 12 days has been taken by the employee this current year")

        # Credit time
        wizard = self.env['l10n_be.hr.payroll.credit.time.wizard'].with_context(allowed_company_ids=self.belgian_company.ids, active_id=full_time_contract.id).new({
            'date_start': date(today.year, 9, 2),
            'date_end': date(today.year, 12, 31),
            'resource_calendar_id': self.resource_calendar_mid_time.id,
            'holiday_status_id': self.paid_time_off_type.id
        })
        self.assertEqual(wizard.time_off_allocation, 0)
        self.assertEqual(wizard.remaining_allocated_time_off, 8)
        self.assertAlmostEqual(wizard.work_time, 50, 2)
        view = wizard.validate_credit_time()
        credit_time_contract = self.env['hr.contract'].search(view['domain']).filtered(lambda contract: contract.id != full_time_contract.id)

        # Normally he has already taken all his paid time offs, if he takes another, we should have an error
        with self.assertRaises(ValidationError):
            leave = self.env['hr.leave'].create({
                'holiday_status_id': self.paid_time_off_type.id,
                'employee_id': self.employee_a.id,
                'request_date_from': date(today.year, 10, 4),
                'request_date_to': date(today.year, 10, 4),
                'number_of_days': 1
            })
            leave.action_validate()
