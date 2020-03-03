# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from datetime import datetime

from odoo.exceptions import AccessError
from odoo.tests.common import new_test_user

from .common import TestCommonForecast


class TestForecastAccessRights(TestCommonForecast):

    @classmethod
    def setUpClass(cls):
        super(TestForecastAccessRights, cls).setUpClass()

        cls.setUpEmployees()
        cls.setUpProjects()

        # employee - without planning rights
        cls.user = new_test_user(
            cls.env,
            login='user',
            groups='base.group_user'
        )

        cls.employee = cls.env['hr.employee'].create({
            'user_id': cls.user.id
        })
        # employee - planning user
        cls.user_planning_user = new_test_user(
            cls.env,
            login='planning user',
            groups='base.group_user,planning.group_planning_user'
        )
        cls.employee_planning_user = cls.env['hr.employee'].create({
            'user_id': cls.user_planning_user.id
        })
        # employee - planning manager
        cls.user_planning_manager = new_test_user(
            cls.env,
            login='planning manager',
            groups='base.group_user,planning.group_planning_manager'
        )
        cls.employee_planning_manager = cls.env['hr.employee'].create({
            'user_id': cls.user_planning_manager.id
        })
        # employee - planning + project manager
        cls.user_pp_manager = new_test_user(
            cls.env,
            login='planning+project manager',
            groups='base.group_user,planning.group_planning_manager,project.group_project_manager'
        )
        cls.employee_pp_manager = cls.env['hr.employee'].create({
            'user_id': cls.user_pp_manager.id
        })

        slot_values = {
            'start_datetime': datetime(2019, 6, 5, 8),
            'end_datetime': datetime(2019, 6, 5, 17),
            'allocated_hours': 8,
            'project_id': cls.project_opera.id
        }
        cls.project_opera.privacy_visibility = 'followers'

        cls.slot_employee_no_user = cls.env['planning.slot'].create({'employee_id': cls.employee_joseph.id, **slot_values})
        cls.slot_employee = cls.env['planning.slot'].create({'employee_id': cls.employee.id, **slot_values})
        cls.slot_employee_planning_user = cls.env['planning.slot'].create({'employee_id': cls.employee_planning_user.id, **slot_values})
        cls.slot_employee_planning_manager = cls.env['planning.slot'].create({'employee_id': cls.employee_planning_manager.id, **slot_values})
        cls.slot_employee_pp_manager = cls.env['planning.slot'].create({'employee_id': cls.employee_pp_manager.id, **slot_values})
        cls.all_slots = cls.slot_employee_no_user + cls.slot_employee + cls.slot_employee_planning_user + cls.slot_employee_planning_manager + cls.slot_employee_pp_manager

    def test_slot_employee(self):
        # As the project is private, only project manager can see it.
        self.assertTrue(self.slot_employee_no_user.is_private_project)
        self.assertTrue(self.slot_employee.is_private_project)
        self.assertTrue(self.slot_employee_planning_user.is_private_project)
        self.assertTrue(self.slot_employee_planning_manager.is_private_project)
        self.assertFalse(self.slot_employee_pp_manager.is_private_project)

        with self.assertRaises(AccessError):
            self.slot_employee.with_user(self.user.id).read()
        with self.assertRaises(AccessError):
            self.slot_employee.with_user(self.user_planning_user.id).read()
        self.slot_employee.with_user(self.user_planning_manager.id).read()
        self.slot_employee.with_user(self.user_pp_manager.id).read()

    def test_slot_employee_add_allow_user(self):
        # As the project is private and all user has been added in allowed list, all employees linked to user can see it.
        self.project_opera.allowed_internal_user_ids = [(4, self.user.id, 0), (4, self.user_planning_user.id, 0), (4, self.user_planning_manager.id, 0)]
        self.assertTrue(self.slot_employee_no_user.is_private_project)
        self.assertFalse(self.slot_employee.is_private_project)
        self.assertFalse(self.slot_employee_planning_user.is_private_project)
        self.assertFalse(self.slot_employee_planning_manager.is_private_project)
        self.assertFalse(self.slot_employee_pp_manager.is_private_project)

    def test_slot_employee_project_visibility_employees(self):
        # As the project is visible for employee, all employees can see it.
        self.project_opera.privacy_visibility = 'employees'
        self.assertFalse(self.slot_employee_no_user.is_private_project)
        self.assertFalse(self.slot_employee.is_private_project)
        self.assertFalse(self.slot_employee_planning_user.is_private_project)
        self.assertFalse(self.slot_employee_planning_manager.is_private_project)
        self.assertFalse(self.slot_employee_pp_manager.is_private_project)

    def test_slot_employee_project_visibility_portal(self):
        # As the project is visible for portal, all employees can see it.
        self.project_opera.privacy_visibility = 'portal'
        self.assertFalse(self.slot_employee_no_user.is_private_project)
        self.assertFalse(self.slot_employee.is_private_project)
        self.assertFalse(self.slot_employee_planning_user.is_private_project)
        self.assertFalse(self.slot_employee_planning_manager.is_private_project)
        self.assertFalse(self.slot_employee_pp_manager.is_private_project)

    def test_slot_with_task(self):
        # As the project is private and task give no more access, only project manager can see it.
        self.all_slots.task_id = self.task_opera_place_new_chairs
        self.assertTrue(self.slot_employee_no_user.is_private_project)
        self.assertTrue(self.slot_employee.is_private_project)
        self.assertTrue(self.slot_employee_planning_user.is_private_project)
        self.assertTrue(self.slot_employee_planning_manager.is_private_project)
        self.assertFalse(self.slot_employee_pp_manager.is_private_project)

    def test_slot_with_task_and_user_is_allowed_task(self):
        # As the project is private and all user has been added in allowed list of task (not project),
        # all employees linked to user can see it.
        self.task_opera_place_new_chairs.allowed_user_ids = [(4, self.user.id, 0), (4, self.user_planning_user.id, 0), (4, self.user_planning_manager.id, 0)]
        self.all_slots.task_id = self.task_opera_place_new_chairs
        self.assertTrue(self.slot_employee_no_user.is_private_project)
        self.assertFalse(self.slot_employee.is_private_project)
        self.assertFalse(self.slot_employee_planning_user.is_private_project)
        self.assertFalse(self.slot_employee_planning_manager.is_private_project)
        self.assertFalse(self.slot_employee_pp_manager.is_private_project)
