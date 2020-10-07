from datetime import date

from odoo.tests import tagged

from .common import TestPayrollCommon


@tagged('post_install', '-at_install', 'alloc_paid_time_off')
class TestPayrollAllocatingPaidTimeOff(TestPayrollCommon):

    def setUp(self):
        super(TestPayrollAllocatingPaidTimeOff, self).setUp()

        today = date.today()
        self.paid_time_off_type = self.holiday_leave_types.filtered(lambda leave_type: leave_type.validity_start == date(today.year, 1, 1) and leave_type.validity_stop == date(today.year, 12, 31))

        self.wizard = self.env['hr.payroll.alloc.paid.leave'].create({
            'year': today.year - 1,
            'holiday_status_id': self.paid_time_off_type.id
        })
        self.wizard._onchange_struct_id()
        self.wizard.alloc_employee_ids = self.wizard.alloc_employee_ids.filtered(lambda alloc_employee: alloc_employee.employee_id.id in [self.employee_georges.id, self.employee_john.id])

    def test_allocating_paid_time_off(self):
        """
        Last year, the employee Georges had these contracts:
        - From 01/01 to 31/05, he worked at mid time, 3 days/week
        - From 01/06 to 31/08, he worked at full time, 5 days/week
        - From 01/09 to 31/12, he worked at 4/5, 4 days/week

        and the employee John Doe had these contracts :
        - From 01/01 to 31/03, he worked at full time
        - From 01/04 to 30/06, he worked at 9/10 time
        - From 01/07 to 30/09, he worked at 4/5 time
        - From 01/10 to 31/12, he worked at mid time

        Normally, we must allocate 14,5 days to Georges and 14 days to John for this year.
        """
        self.assertEqual(len(self.wizard.alloc_employee_ids), 2, "Normally we should find 2 employees to allocate their paid time off for the next period")

        self.assertEqual(self.wizard.alloc_employee_ids.filtered(lambda alloc_employee: alloc_employee.employee_id.id == self.employee_georges.id).paid_time_off, 14.5, "Georges should have 14.5 days paid time offs for this year.")
        self.assertEqual(self.wizard.alloc_employee_ids.filtered(lambda alloc_employee: alloc_employee.employee_id.id == self.employee_john.id).paid_time_off, 16, "John Doe should have 16 days paid time offs for this year.")

    def test_reallocate_paid_time_off_based_contract_next_year(self):
        """
        In two first leave we see the paid time off allocated for both employee based on their contract in the last year.
        But we need to check the contract for this year to allocate the correct amount of paid time off.

        This year, Georges begins to work a 4/5 and John continues his last contract at mid-time.
        """
        self.assertEqual(len(self.wizard.alloc_employee_ids), 2, "Normally, we should find 2 employees to allocate their paid time off for the next period")

        alloc_employee = self.wizard.alloc_employee_ids.filtered(lambda alloc_employee: alloc_employee.employee_id.id == self.employee_georges.id)
        self.assertEqual(alloc_employee.paid_time_off_to_allocate, 14.5, "With a 4/5 time in this period, Georges could have 16 days of paid time off but his working schedule in last period allow him 14.5 days")

        alloc_employee = self.wizard.alloc_employee_ids.filtered(lambda alloc_employee: alloc_employee.employee_id.id == self.employee_john.id)
        self.assertEqual(alloc_employee.paid_time_off_to_allocate, 10, "With a mid-time in this period, John Doe should have 10 days of paid time off but we must retain that he could have 16 days at total this period")

        view = self.wizard.generate_allocation()
        allocations = self.env['hr.leave.allocation'].search(view['domain'])
        georges_allocation = allocations.filtered(lambda alloc: alloc.employee_id.id == self.employee_georges.id)

        self.assertEqual(georges_allocation.number_of_days, 14.5)
        self.assertEqual(georges_allocation.max_leaves_allocated, 14.5, "based on the last year, we retain that John can have at most 16 days of paid time off")

        john_allocation = allocations.filtered(lambda alloc: alloc.employee_id.id == self.employee_john.id)

        self.assertEqual(john_allocation.number_of_days, 10)
        self.assertEqual(john_allocation.max_leaves_allocated, 16)
