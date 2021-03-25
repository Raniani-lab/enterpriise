# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from psycopg2 import IntegrityError

from odoo.tests import tagged
from odoo.tools import mute_logger

from .common import TestFsmFlowSaleCommon


@tagged('-at_install', 'post_install', 'fsm_project')
class TestIndustryFsmProject(TestFsmFlowSaleCommon):

    def test_timesheet_product_is_required(self):
        """ Test if timesheet product is required in billable fsm project

            To do this we need to check if an exception is raise when the timesheet
            product is False/None and the project config has this props:
                - allow_billable=True,
                - allow_timesheets=True,
                - is_fsm=True.

            Test Case:
            =========
            Remove the timesheeet product in the billable fsm project and check if an exception is raise.
        """
        with mute_logger('odoo.sql_db'):
            with self.assertRaises(IntegrityError):
                self.fsm_project.write({'timesheet_product_id': False})
                self.fsm_project.flush()

    def test_convert_project_into_fsm_project(self):
        """ Test when we want to convert a project to fsm project

            Normally, this project should be billable and its pricing type should be task_rate.

            Test Case:
            =========
            1) Convert a non billable project to a fsm project and check if
                - allow_billable=True,
                - pricing_type="task_rate",
                - is_fsm=True,
                - allow_material=True,
            2) Convert a project with pricing_type="employee_rate"
            3) Convert a project with pricing_type="project_rate"
        """
        # 1) Convert a non billable project to a fsm project
        self.project_non_billable.write({'is_fsm': True})
        self.assertTrue(self.project_non_billable.allow_billable)
        self.assertTrue(self.project_non_billable.is_fsm)
        self.assertTrue(self.project_non_billable.allow_material)
        self.assertEqual(self.project_non_billable.pricing_type, 'task_rate')

        # 2) Convert a project with pricing_type="employee_rate"
        # Configuration of the employee rate project before convert it into fsm project
        self.project_employee_rate.write({
            'sale_order_id': self.so.id,
            'sale_line_id': self.so.order_line[0].id,
            'sale_line_employee_ids': [(0, 0, {
                'employee_id': self.employee_user.id,
                'sale_line_id': self.so.order_line[1].id,
            })]
        })
        # Convert the project into fsm project
        self.project_employee_rate.write({'is_fsm': True})
        # Check if the configuration is the one expected
        self.assertTrue(self.project_employee_rate.is_fsm)
        self.assertTrue(self.project_employee_rate.allow_material)
        self.assertEqual(self.project_employee_rate.pricing_type, 'employee_rate')
        self.assertFalse(self.project_employee_rate.sale_order_id)
        self.assertFalse(self.project_employee_rate.sale_line_id)

        # 3) Convert a project with pricing_type="project_rate"
        self.project_project_rate.write({'is_fsm': True})
        self.assertTrue(self.project_project_rate.is_fsm)
        self.assertTrue(self.project_project_rate.allow_material)
        self.assertEqual(self.project_project_rate.pricing_type, 'task_rate')
        self.assertFalse(self.project_project_rate.sale_order_id)
        self.assertFalse(self.project_project_rate.sale_line_id)
