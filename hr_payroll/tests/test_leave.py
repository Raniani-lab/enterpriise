# # -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo.addons.hr_payroll.tests.common import TestPayslipBase


class TestPayrollLeave(TestPayslipBase):

    def test_resource_leave_has_work_entry_type(self):
        leave = self.create_leave()

        resource_leave = leave._create_resource_leave()
        self.assertEqual(resource_leave.work_entry_type_id, self.leave_type.work_entry_type_id, "it should have the corresponding work_entry type")

    def test_resource_leave_in_contract_calendar(self):
        other_calendar = self.env['resource.calendar'].create({'name': 'New calendar'})
        contract = self.richard_emp.contract_ids[0]
        contract.resource_calendar_id = other_calendar
        contract.state = 'open'  # this set richard's calendar to New calendar
        leave = self.create_leave()

        resource_leave = leave._create_resource_leave()
        self.assertEqual(len(resource_leave), 1, "it should have created only one resource leave")
        self.assertEqual(resource_leave.work_entry_type_id, self.leave_type.work_entry_type_id, "it should have the corresponding work_entry type")

    def test_resource_leave_different_calendars(self):
        other_calendar = self.env['resource.calendar'].create({'name': 'New calendar'})
        contract = self.richard_emp.contract_ids[0]
        contract.resource_calendar_id = other_calendar
        contract.state = 'open'  # this set richard's calendar to New calendar

        # set another calendar
        self.richard_emp.resource_calendar_id = self.env['resource.calendar'].create({'name': 'Other calendar'})

        leave = self.create_leave()
        resource_leave = leave._create_resource_leave()
        self.assertEqual(len(resource_leave), 2, "it should have created one resource leave per calendar")
        self.assertEqual(resource_leave.mapped('work_entry_type_id'), self.leave_type.work_entry_type_id, "they should have the corresponding work_entry type")

    def test_create_mark_conflicting_work_entries(self):
        work_entry = self.create_work_entry(datetime(2019, 10, 10, 9, 0), datetime(2019, 10, 10, 12, 0))
        self.assertFalse(work_entry.display_warning, "It should not be conflicting")
        leave = self.create_leave(datetime(2019, 10, 10, 9, 0), datetime(2019, 10, 10, 18, 0))
        self.assertTrue(work_entry.display_warning, "It should be conflicting")
        self.assertEqual(work_entry.leave_id, leave, "It should be linked to conflicting leave")

    def test_write_mark_conflicting_work_entries(self):
        leave = self.create_leave(datetime(2019, 10, 10, 9, 0), datetime(2019, 10, 10, 12, 0))
        work_entry = self.create_work_entry(datetime(2019, 10, 9, 9, 0), datetime(2019, 10, 10, 9, 0))  # the day before
        self.assertFalse(work_entry.display_warning, "It should not be conflicting")
        leave.date_from = datetime(2019, 10, 9, 9, 0)  # now it conflicts
        self.assertTrue(work_entry.display_warning, "It should be conflicting")
        self.assertEqual(work_entry.leave_id, leave, "It should be linked to conflicting leave")

    def test_validate_leave_with_overlap(self):
        contract = self.richard_emp.contract_ids[:1]
        contract.state = 'open'
        contract.date_generated_from = datetime(2019, 10, 10, 9, 0)
        contract.date_generated_to = datetime(2019, 10, 10, 9, 0)
        leave = self.create_leave(datetime(2019, 10, 10, 9, 0), datetime(2019, 10, 12, 18, 0))
        work_entry_1 = self.create_work_entry(datetime(2019, 10, 8, 9, 0), datetime(2019, 10, 11, 9, 0))  # overlaps
        work_entry_2 = self.create_work_entry(datetime(2019, 10, 11, 9, 0), datetime(2019, 10, 11, 18, 0))  # included
        adjacent_work_entry = self.create_work_entry(datetime(2019, 10, 12, 18, 0), datetime(2019, 10, 13, 18, 0))  # after and don't overlap
        leave.action_validate()
        self.assertFalse(adjacent_work_entry.display_warning, "It should not conflict")
        self.assertFalse(work_entry_2.active, "It should have been archived")
        self.assertTrue(work_entry_1.display_warning, "It should conflict")
        self.assertFalse(work_entry_1.leave_id, "It should not be linked to the leave")

        leave_work_entry = self.env['hr.work.entry'].search([('leave_id', '=', leave.id)]) - work_entry_1
        self.assertTrue(leave_work_entry.work_entry_type_id.is_leave, "It should have created a leave work entry")
        self.assertTrue(leave_work_entry.display_warning, "The leave work entry should conflict")

    def test_conflict_move_work_entry(self):
        leave = self.create_leave(datetime(2019, 10, 10, 9, 0), datetime(2019, 10, 12, 18, 0))
        work_entry = self.create_work_entry(datetime(2019, 10, 8, 9, 0), datetime(2019, 10, 11, 9, 0))  # overlaps
        self.assertTrue(work_entry.display_warning, "It should be conflicting")
        self.assertEqual(work_entry.leave_id, leave, "It should be linked to conflicting leave")
        work_entry.date_stop = datetime(2019, 10, 9, 9, 0)  # no longer overlaps
        self.assertFalse(work_entry.display_warning, "It should no longer conflict")
        self.assertFalse(work_entry.leave_id, "It should not be linked to any leave")

    def test_validate_leave_without_overlap(self):
        contract = self.richard_emp.contract_ids[:1]
        contract.state = 'open'
        contract.date_generated_from = datetime(2019, 10, 10, 9, 0)
        contract.date_generated_to = datetime(2019, 10, 10, 9, 0)
        leave = self.create_leave(datetime(2019, 10, 10, 9, 0), datetime(2019, 10, 12, 18, 0))
        work_entry = self.create_work_entry(datetime(2019, 10, 11, 9, 0), datetime(2019, 10, 11, 18, 0))  # included
        leave.action_validate()
        self.assertFalse(work_entry.active, "It should have been archived")

        leave_work_entry = self.env['hr.work.entry'].search([('leave_id', '=', leave.id)])
        self.assertTrue(leave_work_entry.work_entry_type_id.is_leave, "It should have created a leave work entry")
        self.assertFalse(leave_work_entry.display_warning, "The leave work entry should not conflict")

    def test_refuse_leave(self):
        leave = self.create_leave(datetime(2019, 10, 10, 9, 0), datetime(2019, 10, 10, 18, 0))
        work_entries = self.richard_emp.contract_id._generate_work_entries(datetime(2019, 10, 10, 9, 0), datetime(2019, 10, 10, 18, 0))
        adjacent_work_entry = self.create_work_entry(datetime(2019, 10, 7, 9, 0), datetime(2019, 10, 10, 9, 0))
        self.assertTrue(all(work_entries.mapped('display_warning')), "Attendance work entries should all conflict with the leave")
        self.assertFalse(adjacent_work_entry.display_warning, "Non overlapping work entry should not conflict")
        leave.action_refuse()
        self.assertTrue(not any(work_entries.mapped('display_warning')), "Attendance work entries should no longer conflict")
        self.assertFalse(adjacent_work_entry.display_warning, "Non overlapping work entry should not conflict")

    def test_refuse_approved_leave(self):
        start = datetime(2019, 10, 10, 9, 0)
        end = datetime(2019, 10, 10, 18, 0)

        # Setup contract generation state
        contract = self.richard_emp.contract_ids[:1]
        contract.state = 'open'
        contract.date_generated_from = start - relativedelta(hours=1)
        contract.date_generated_to = start - relativedelta(hours=1)

        leave = self.create_leave(start, end)
        leave.action_validate()
        work_entries = self.env['hr.work.entry'].search([('employee_id', '=', self.richard_emp.id), ('date_start', '<=', end), ('date_stop', '>=', start)])
        leave_work_entry = self.richard_emp.contract_ids._generate_work_entries(start, end)
        self.assertEqual(leave_work_entry.leave_id, leave)
        leave.action_refuse()
        work_entries = self.env['hr.work.entry'].search([('employee_id', '=', self.richard_emp.id), ('date_start', '>=', start), ('date_stop', '<=', end)])
        self.assertFalse(leave_work_entry.filtered('leave_id').active)
        self.assertEqual(len(work_entries), 2, "Attendance work entries should have been re-created (morning and afternoon)")
        self.assertTrue(not any(work_entries.mapped('display_warning')), "Attendance work entries should not conflict")
