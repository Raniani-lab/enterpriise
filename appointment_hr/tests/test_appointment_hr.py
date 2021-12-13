# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo.exceptions import ValidationError
from odoo.tests import common, tagged, users

@tagged('-at_install', 'post_install')
class AppointmentHrTest(common.HttpCase):

    def setUp(self):
        super(AppointmentHrTest, self).setUp()
        # Calendar events can mess up the availability of our staff user later on.
        self.env['calendar.event'].search([]).unlink()

        self.first_staff_user_in_brussel = self.env['res.users'].create({
            'name': 'Grace Slick',
            'login': 'grace',
            'tz': 'Europe/Brussels'
        })
        self.second_staff_user_in_australia = self.env['res.users'].create({
            'name': 'Australian guy',
            'login': 'australian',
            'tz': 'Australia/West'
        })

        self.company = self.env['res.company'].search([], limit=1)

        # Employee Work Hours
        self.resource_calendar = self.env['resource.calendar'].create({
            'name': 'Small Day',
            'company_id': self.company.id
        })

        # Wipe out all attendances and write one on resource_calendar
        self.resource_calendar.write({'attendance_ids': [(5, False, False)]})
        self.attendance = self.env['resource.calendar.attendance'].create({
            'name': 'monday morning',
            'dayofweek': '0',
            'hour_from': 8,
            'hour_to': 12,
            'calendar_id': self.resource_calendar.id
        })

        self.resource = self.env['resource.resource'].create({
            'name': self.first_staff_user_in_brussel.name,
            'user_id': self.first_staff_user_in_brussel.id,
            'calendar_id': self.resource_calendar.id
        })

        self.first_staff_user_in_brussel.write({'resource_ids': [(6, 0, self.resource.id)]})

        self.employee_in_brussel = self.env['hr.employee'].create({
            'name': 'Grace Slick',
            'company_id': self.company.id,
            'resource_id': self.resource.id,
            'resource_calendar_id': self.resource_calendar.id
        })

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

    @users('admin')
    def test_search_create_work_hours(self):
        self.authenticate('admin', 'admin')
        request = self.url_open(
            "/appointment/calendar_appointment_type/search_create_work_hours",
            data=json.dumps({}),
            headers={"Content-Type": "application/json"},
        ).json()
        result = request.get('result', False)
        self.assertTrue(result.get('id'), 'The request returns the id of the custom appointment type')
        appointment_type = self.env['calendar.appointment.type'].browse(result['id'])
        self.assertEqual(appointment_type.category, 'work_hours')
        self.assertEqual(len(appointment_type.slot_ids), 14, "Two slots have been created")
        self.assertTrue(all(slot.slot_type == 'recurring' for slot in appointment_type.slot_ids), "All slots are 'recurring'")
