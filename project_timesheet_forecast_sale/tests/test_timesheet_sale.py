# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details
from datetime import datetime

from odoo.addons.sale_timesheet.tests.common import TestCommonSaleTimesheet
from odoo.tests import tagged


@tagged('-at_install', 'post_install')
class TestPlanningTimesheetSale(TestCommonSaleTimesheet):

    def test_generate_slot_timesheet_for_non_billable_project(self):
        self.assertFalse(self.project_non_billable.allow_billable, "Project should be non billable")

        non_billable_task = self.env['project.task'].create({
            'name': 'Task1',
            'project_id': self.project_non_billable.id,
        })

        self.assertEqual(self.manager_company_B.tz, self.manager_company_B.resource_calendar_id.tz)

        planning_shift = self.env['planning.slot'].create({
            'project_id': self.project_non_billable.id,
            'task_id': non_billable_task.id,
            'employee_id': self.manager_company_B.id,
            'resource_id': self.manager_company_B.resource_id.id,
            'allocated_hours': 8,
            'start_datetime': datetime(2019, 6, 6, 8, 0, 0),  # 6/6/2019 is a tuesday, so a working day
            'end_datetime': datetime(2019, 6, 6, 17, 0, 0),
            'allocated_percentage': 100,
            'state': 'published',
        })
        self.assertFalse(planning_shift.timesheet_ids, "There should be no timesheet linked with current shift")
        planning_shift._action_generate_timesheet()
        self.assertEqual(len(planning_shift.timesheet_ids), 1, "One timesheet should be generated for non billable project")
        self.assertEqual(planning_shift.timesheet_ids.unit_amount, 6, "Timesheet should be generated for the 8 working hours of the employee")

    def test_generate_slot_timesheet_for_billable_project(self):
        self.assertTrue(self.project_global.allow_billable, "Project should be billable")

        billable_task = self.env['project.task'].create({
            'name': 'Task1',
            'project_id': self.project_global.id,
        })

        planning_shift = self.env['planning.slot'].create({
            'project_id': self.project_global.id,
            'task_id': billable_task.id,
            'sale_line_id': self.so.order_line.filtered(lambda x: x.product_id == self.product_delivery_timesheet2).id,
            'employee_id': self.manager_company_B.id,
            'resource_id': self.manager_company_B.resource_id.id,
            'allocated_hours': 5,
            'start_datetime': datetime(2019, 6, 6, 8, 0, 0),  # 6/6/2019 is a tuesday, so a working day
            'end_datetime': datetime(2019, 6, 6, 14, 0, 0),
            'allocated_percentage': 100,
            'state': 'published',
        })
        self.assertFalse(planning_shift.timesheet_ids, "There should be no timesheet linked with current shift")
        planning_shift._action_generate_timesheet()
        self.assertEqual(len(planning_shift.timesheet_ids), 1, "One timesheet should be generated for billable project")
        self.assertEqual(planning_shift.timesheet_ids.so_line, planning_shift.sale_line_id, "Generated timesheet should be linked with same so line as shift.")
        self.assertEqual(planning_shift.timesheet_ids.so_line.qty_delivered, planning_shift.timesheet_ids.unit_amount, "Timesheet and so line should have same delivered quantity.")
