# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details
from datetime import datetime

from .common import TestCommonForecast


class TestForecastPublishing(TestCommonForecast):

    @classmethod
    def setUpClass(cls):
        super(TestForecastPublishing, cls).setUpClass()

        cls.setUpEmployees()
        cls.setUpProjects()

        # employee without work email
        cls.employee_dirk_no_mail = cls.env['hr.employee'].create({
            'user_id': False,
            'name': 'Dirk',
            'work_email': False,
            'tz': 'UTC'
        })

        values = {
            'project_id': cls.project_opera.id,
            'employee_id': cls.employee_joseph.id,
            'resource_hours': 8,
            'start_datetime': datetime(2019, 6, 6, 8, 0, 0),
            'end_datetime': datetime(2019, 6, 6, 17, 0, 0)
        }
        cls.forecast = cls.env['project.forecast'].create(values)

    def test_forecast_publication(self):
        self.assertFalse(self.forecast.published, 'forecast is not published by default')  # False on creation

        self.forecast.write({'published': True})

        self.forecast.write({'resource_hours': 10})          # the field goes back to False if an important field changes
        self.assertFalse(self.forecast.published, 'published updates on forecast edition')

        self.forecast.write({'published': False})

        Mails = self.env['mail.mail']
        before_mails = Mails.search([])

        self.forecast.action_send()
        self.assertTrue(self.forecast.published, 'forecast is published when we call its action_send')

        forecast_mails = set(Mails.search([])) ^ set(before_mails)
        self.assertEqual(len(forecast_mails), 1, 'only one mail is created when publishing forecast')
        self.assertEqual(list(forecast_mails)[0].model, 'project.forecast', 'the mail model is forecast')
        self.assertEqual(list(forecast_mails)[0].record_name, self.forecast.name, 'the mail is attached to the right forecast')

    def test_sending_forecast_do_not_create_mail_if_employee_has_no_email(self):
        self.forecast.write({'employee_id': self.employee_dirk_no_mail.id})

        self.assertFalse(self.employee_dirk_no_mail.work_email)  # if no work_email

        Mails = self.env['mail.mail']
        before_mails = Mails.search([])

        self.forecast.action_send()
        forecast_mails = set(Mails.search([])) ^ set(before_mails)
        self.assertEqual(len(forecast_mails), 0, 'no mail should be sent when the employee has no work email')
