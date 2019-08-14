# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details
from datetime import datetime, timedelta

from odoo.exceptions import ValidationError

from .common import TestCommonForecast


class TestForecastCreationAndEditing(TestCommonForecast):

    @classmethod
    def setUpClass(cls):
        super(TestForecastCreationAndEditing, cls).setUpClass()

        cls.setUpEmployees()
        cls.setUpProjects()

    def test_creating_a_forecast_resource_hours_are_correct(self):
        values = {
            'project_id': self.project_opera.id,
            'employee_id': self.employee_bert.id,
            'resource_hours': 8,
            'start_datetime': datetime(2019, 6, 6, 8, 0, 0),  # 6/6/2019 is a tuesday, so a working day
            'end_datetime': datetime(2019, 6, 6, 17, 0, 0)
        }

        # forecast on one day
        forecast = self.env['project.forecast'].create(values)

        self.assertEqual(forecast.resource_hours, 8.0, 'resource hours should be a full workday')
        self.assertEqual(forecast.resource_time, 100.0, 'resource hours are equal to work schedule, 100% time allocated')

        # forecast on multiple days
        values = {
            'resource_hours': 40,   # full week
            'start_datetime': datetime(2019, 6, 3, 0, 0, 0),  # 6/3/2019 is a monday
            'end_datetime': datetime(2019, 6, 8, 23, 59, 0)  # 6/8/2019 is a sunday, so we have a full week
        }
        forecast.write(values)

        self.assertEqual(forecast.resource_hours, 40, 'resource hours should be a full week\'s available hours')
        self.assertEqual(forecast.resource_time, 100.0, 'resource hours are equal to the week work schedule, 100% time allocated')

        # forecast on non working days
        values = {
            'resource_hours': 8,
            'start_datetime': datetime(2019, 6, 2, 8, 0, 0),  # sunday morning
            'end_datetime': datetime(2019, 6, 2, 17, 0, 0)  # sunday evening, same sunday, so employee is not working
        }
        forecast.write(values)

        self.assertEqual(forecast.resource_hours, 8, 'resource hours should be a full day working hours')
        self.assertEqual(forecast.resource_time, 800, 'employee is not working that day, allocated time is 800%')

    def test_task_in_project(self):
        values = {
            'project_id': self.project_opera.id,
            'task_id': self.task_horizon_dawn.id,  # oops, task_horizon_dawn is into another project
            'employee_id': self.employee_bert.id,
            'resource_hours': 8,
            'start_datetime': datetime(2019, 6, 2, 8, 0, 0),
            'end_datetime': datetime(2019, 6, 2, 17, 0, 0)
        }
        with self.assertRaises(ValidationError, msg="""it should not be possible to create a forecast
                                                    linked to a task that is in another project
                                                    than the one linked to the forecast"""):
            self.env['project.forecast'].create(values)

    def test_resource_time_adapt_when_changing_other_fields(self):
        """We need resource_time to change dynamically, as forecasts can be displayed
            on the gantt view, which allow to move them (to another slot, expand/shrink, change employee/project/task, etc...)
        """
        # initially resource_time wil be 100 (%), 6/6/2019 is a thursday
        values = {
            'project_id': self.project_opera.id,
            'employee_id': self.employee_bert.id,
            'resource_hours': 8,
            'start_datetime': datetime(2019, 6, 6, 8, 0, 0),
            'end_datetime': datetime(2019, 6, 6, 17, 0, 0)
        }
        forecast = self.env['project.forecast'].create(values)
        self.assertEqual(forecast.resource_time, 100.0, 'initial allocated time should be 100% (8hrs on 1 day)')

        # we add 1 day to end_datetime, resource_time should drop to 50 (its like dragging the pill 1 slot on the right)
        forecast.end_datetime += timedelta(days=1)
        self.assertEqual(forecast.resource_time, 50.0, 'allocated time should be 50%, since span is 2 days and hours are 8')

        # we substract 2 days to start_datetime, resource_time should drop to 25 (like if we dragged the pill 2 slots to the left)
        forecast.start_datetime -= timedelta(days=2)
        self.assertEqual(forecast.resource_time, 25.0, 'allocated time should be 25%, span is 4 days and hours are 8')

        # we add one week to both start and end datetime, resource_time should remain the same (like if we moved the pill)
        forecast.end_datetime += timedelta(weeks=1)
        forecast.start_datetime += timedelta(weeks=1)
        self.assertEqual(forecast.resource_time, 25.0, 'allocated time should be 25%, span is 4 days and hours are 8 (shifted to next week)')

        # we shift the forecast one day later, so that the forecast end on saturday evening, meaning that instead of being
        # available 32 hrs, the employee only is available 24 hrs (3 days of 8 hrs)
        forecast.end_datetime += timedelta(days=1)
        forecast.start_datetime += timedelta(days=1)
        self.assertEqual(forecast.resource_time, int(100 * 8.0 / 24.0), 'allocated time should be 33.33%, span is 4 days but one of them is a saturday, hours are 8 ()')
