# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details
from collections import defaultdict
from datetime import datetime

from odoo.tests.common import Form

from .common import TestCommonForecast


class TestForecastFormAndWizards(TestCommonForecast):
    @classmethod
    def setUpClass(cls):
        super(TestForecastFormAndWizards, cls).setUpClass()

        cls.setUpEmployees()
        cls.setUpProjects()

    def test_forecast_span_adapts_to_employee_work_schedule_in_create_wizard(self):
        """When creating a forecast through the create wizard, it's span should map to the employee's work schedule.
            eg: if we select an entire week, monday to sunday. It can only work from monday 8 am to friday
                17 pm (assuming a standard work schedule)
        """
        initial_start_datetime = datetime(2019, 6, 3, 0)            # monday midnight
        initial_end_datetime = datetime(2019, 6, 9, 23, 59, 59)     # sunday right before midnight
        expected_start_datetime = datetime(2019, 6, 3, 8, 0, 0)     # monday 08:00
        expected_end_datetime = datetime(2019, 6, 7, 17, 0, 0)      # friday 17:00

        ctx = {
            'default_employee_id': self.employee_joseph.id,
            'default_project_id': self.project_opera.id,
            'default_start_datetime': initial_start_datetime,
            'default_end_datetime': initial_end_datetime,
        }
        with Form(self.env['project.forecast.create'].with_context(ctx)) as create_wizard:

            self.assertEqual(
                create_wizard.start_datetime,
                expected_start_datetime,
                'the start date in the wizard match the begining of the employee work schedule'
            )
            self.assertEqual(
                create_wizard.end_datetime,
                expected_end_datetime,
                'then end dat in the wizard match the end of the employee work schedule'
            )

    def test_autocomplete_suggest_forecasts_with_distinct_projects(self):
        start_datetime = datetime(2019, 6, 3, 0)
        end_datetime = datetime(2019, 6, 3, 23)
        projects = [self.project_opera, self.project_horizon] * 2  # create 2 forecasts for each projects
        forecasts = self.env['project.forecast'].create(map(lambda project: {
            'employee_id': self.employee_joseph.id,
            'project_id': project.id,
            'start_datetime': start_datetime,
            'end_datetime': end_datetime,
        }, projects))

        self.assertEqual(len(forecasts), 4, '2 forecast in 2 projects should make 4 forecasts')

        ctx = {'default_employee_id': self.employee_joseph}

        with Form(self.env['project.forecast.create'].with_context(ctx)) as create_wizard:
            self.assertEqual(len(create_wizard.autocomplete_forecast_ids), 2)

            project_histogram = defaultdict(int)  # count every project occurrence
            for previous_forecast in create_wizard.autocomplete_forecast_ids:
                project_histogram[previous_forecast.project_id] += 1

            for project, count in project_histogram.items():
                self.assertEqual(count, 1, 'every project should show only once')

            # fill the required values, so that the wizard can be saved and we can exit the context manager
            create_wizard.project_id = self.project_opera
            create_wizard.start_datetime = datetime(2019, 6, 3, 0)
            create_wizard.end_datetime = datetime(2019, 6, 3, 23)
