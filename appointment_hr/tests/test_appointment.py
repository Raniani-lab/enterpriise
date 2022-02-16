# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.appointment.tests.test_appointment import AppointmentTest
from odoo.exceptions import ValidationError
from odoo.tests import users


class AppointmentHrTest(AppointmentTest):

    @users('admin')
    def test_create_work_hours_appointment_without_employee(self):
        # No Validation Error, the actual employee should be set by default
        self.env['calendar.appointment.type'].create({
            'name': 'Work hours without employee',
            'category': 'work_hours',
        })

    @users('admin')
    def test_create_work_hours_appointment_multiple_employees(self):
        with self.assertRaises(ValidationError):
            self.env['calendar.appointment.type'].create({
                'name': 'Work hours without employee',
                'category': 'work_hours',
                'staff_user_ids': [self.first_staff_user_in_brussel.id, self.second_staff_user_in_australia.id]
            })
