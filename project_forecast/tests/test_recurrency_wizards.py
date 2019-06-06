# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from datetime import datetime

from odoo.tests.common import Form

from .test_recurrency import TestCommonForecast


class TestRecurrencyForecastFormAndWizards(TestCommonForecast):

    @classmethod
    def setUpClass(cls):
        super(TestRecurrencyForecastFormAndWizards, cls).setUpClass()

        cls.setUpEmployees()
        cls.setUpProjects()

    def test_create_wizard_entering_repeat_create_the_new_forecast_and_recurrency(self):
        self.env.company.write({
            'forecast_generation_span_interval': 1,
            'forecast_generation_span_uom': 'month',
        })
        with self._patch_now('2019-06-01 08:00:00'):
            ctx = {
                'default_employee_id': self.employee_bert.id,
                'default_project_id': self.project_opera.id,
                'default_start_datetime': datetime(2019, 6, 1, 0, 0),
                'default_end_datetime': datetime(2019, 6, 1, 23, 59),
            }

            wizard = None
            with Form(self.env['project.forecast.create'].with_context(ctx)) as create_wizard:
                create_wizard.repeat = True
                create_wizard.repeat_interval = 1
                create_wizard.repeat_unit = 'week'
                create_wizard.repeat_until = False
                wizard = create_wizard.save()

            wizard.action_create_new()

            self.assertEqual(len(self.env['project.forecast.recurrency'].search([])), 1, 'the repeat option on the wizard made it create a recurrency')
            self.assertEqual(len(self.env['project.forecast.recurrency'].search([]).forecast_ids), 5, 'the recurrency has the right repeat_until from the wizard')

    def test_repeat_wizard_makes_a_forecast_recurrent(self):
        with self._patch_now('2019-06-01 08:00:00'):
            ctx = {
                'default_employee_id': self.employee_bert.id,
                'default_project_id': self.project_opera.id,
                'default_start_datetime': datetime(2019, 6, 1, 0, 0),
                'default_end_datetime': datetime(2019, 6, 1, 23, 59),
            }

            form = Form(self.env['project.forecast.create'].with_context(ctx))
            wizard = form.save()
            forecast = wizard.action_create_new()
            self.assertFalse(forecast.recurrency_id)
            self.assertFalse(self.env['project.forecast.recurrency'].search([]))

            repeat_wizard_context = {
                'active_id': forecast.id,
                'active_model': 'project.forecast',
            }

            wizard = None
            with Form(self.env['project.forecast.repeat'].with_context(repeat_wizard_context)) as repeat_wizard:
                repeat_wizard.repeat_interval = 1
                repeat_wizard.repeat_unit = 'week'
                wizard = repeat_wizard.save()
            wizard.action_repeat()

            self.assertEqual(len(self.env['project.forecast.recurrency'].search([])), 1, 'it create a new recurrency')
            self.assertEqual(forecast.recurrency_id, self.env['project.forecast.recurrency'].search([], limit=1), 'it attached our active forecast to the recurrency')
            self.assertEqual(len(self.env['project.forecast'].search([])), 11, 'it effectively repeated the forecasts')
