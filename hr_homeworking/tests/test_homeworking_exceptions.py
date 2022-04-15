# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from psycopg2 import Error

from odoo import tests
from odoo.tools import mute_logger

from .common import TestHrHomeworkingCommon


@tests.tagged('post_install', '-at_install')
class TestHomeworkingSchedules(TestHrHomeworkingCommon):

    def test_overlapping_exceptions(self):

        # Various exceptions across various dates or employees is fine
        self.env['homeworking.exception'].create([{
            'employee_id': self.employee_emp_id,
            'homeworking_location_id': self.unspecified_location_id,
            'date': '2022-5-1'
        }, {
            'employee_id': self.employee_emp_id,
            'homeworking_location_id': self.unspecified_location_id,
            'date': '2022-5-2'
        }, {
            'employee_id': self.employee_hruser_id,
            'homeworking_location_id': self.unspecified_location_id,
            'date': '2022-5-1'
        }, {
            'employee_id': self.employee_hruser_id,
            'homeworking_location_id': self.unspecified_location_id,
            'date': '2022-5-2'
        }])

        # An exception for a date and employee for which an exception already exists is not.
        with self.assertRaises(Error), mute_logger('odoo.sql_db'):
            self.env['homeworking.exception'].create({
                'employee_id': self.employee_emp_id,
                'homeworking_location_id': self.unspecified_location_id,
                'date': '2022-5-1'
            })

        # The value of homeworking_location_id does not matter
        with self.assertRaises(Error), mute_logger('odoo.sql_db'):
            self.env['homeworking.exception'].create({
                'employee_id': self.employee_emp_id,
                'homeworking_location_id': self.office_location_id,
                'date': '2022-5-1'
            })
