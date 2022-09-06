# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from psycopg2 import Error

from odoo import tests
from odoo.exceptions import ValidationError
from odoo.tools import mute_logger

from .common import TestHrHomeworkingCommon


@tests.tagged('post_install', '-at_install')
class TestHomeworkingSchedules(TestHrHomeworkingCommon):

    def test_overlapping_schedules(self):
        self.env['homeworking.schedule'].create({
            'date_start': '2022-4-1',
            'date_end': '2022-8-31',
            'employee_id': self.employee_emp_id,
        })

        # Overlapping schedules during a period.
        with self.assertRaises(ValidationError), mute_logger('odoo.sql_db'):
            self.env['homeworking.schedule'].create({
                'date_start': '2022-6-7',
                'date_end': '2022-12-24',
                'employee_id': self.employee_emp_id,
            })

        # Overlapping schedules during only one day.
        with self.assertRaises(ValidationError), mute_logger('odoo.sql_db'):
            self.env['homeworking.schedule'].create({
                'date_start': '2022-8-31',
                'date_end': '2022-10-31',
                'employee_id': self.employee_emp_id,
            })

        # Overlapping schedules due to empty end date.
        with self.assertRaises(ValidationError), mute_logger('odoo.sql_db'):
            self.env['homeworking.schedule'].create({
                'date_start': '2021-4-1',
                'employee_id': self.employee_emp_id,
            })

        # Schedules not overlapping if adjacent
        self.env['homeworking.schedule'].create({
            'date_start': '2022-9-1',
            'employee_id': self.employee_emp_id,
        })

        # Schedules not overlapping if not the same employee_id
        self.env['homeworking.schedule'].create({
            'date_start': '2022-5-1',
            'date_end': '2022-9-30',
            'employee_id': self.employee_hruser_id,
        })

        # Schedules not overlapping if not the same department_id
        self.env['homeworking.schedule'].create([{
            'date_start': '2022-5-1',
            'date_end': '2022-9-30',
            'department_id': self.hr_dept.id,
        }, {
            'date_start': '2022-6-1',
            'date_end': '2022-10-31',
            'department_id': self.rd_dept.id,
        }])

    def test_schedule_properties(self):
        # Start- and end date on the same day is ok
        self.env['homeworking.schedule'].create({
            'date_start': '2022-5-1',
            'date_end': '2022-5-1',
            'employee_id': self.employee_emp_id
        })

        # End date can't fall before the start date
        with self.assertRaises(Error), mute_logger('odoo.sql_db'):
            self.env['homeworking.schedule'].create({
                'date_start': '2021-4-1',
                'date_end': '2021-3-1',
                'employee_id': self.employee_emp_id,
            })

        # Employee_id and department_id can't both be set
        with self.assertRaises(Error), mute_logger('odoo.sql_db'):
            self.env['homeworking.schedule'].create({
                'date_start': '2022-6-1',
                'date_end': '2021-7-1',
                'employee_id': self.employee_emp_id,
                'department_id': self.rd_dept.id
            })

    def test_default_schedule_values(self):

        # locations that are not passed into schedule creation have location_type undefined
        schedule = self.env['homeworking.schedule'].create({
            'date_start': '2022-5-1',
            'employee_id': self.employee_emp_id
        })
        self.assertEqual(schedule.monday_location_id.location_type, 'unspecified')
        self.assertEqual(schedule.tuesday_location_id.location_type, 'unspecified')
        self.assertEqual(schedule.wednesday_location_id.location_type, 'unspecified')
        self.assertEqual(schedule.thursday_location_id.location_type, 'unspecified')
        self.assertEqual(schedule.friday_location_id.location_type, 'unspecified')
        self.assertEqual(schedule.saturday_location_id.location_type, 'unspecified')
        self.assertEqual(schedule.sunday_location_id.location_type, 'unspecified')
