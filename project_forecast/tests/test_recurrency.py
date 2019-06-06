# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from datetime import datetime

from .common import TestCommonForecast


class TestRecurrencyForecastGeneration(TestCommonForecast):

    @classmethod
    def setUpClass(cls):
        super(TestRecurrencyForecastGeneration, cls).setUpClass()

        cls.setUpEmployees()
        cls.setUpProjects()

    def _configure_recurrency_span(self, span_qty, span_uom):
        self.env.company.write({
            'forecast_generation_span_interval': span_qty,
            'forecast_generation_span_uom': span_uom,
        })

    def test_recurrency_without_forecasts_gets_deleted_by_the_cron(self):
        with self._patch_now('2020-06-27 08:00:00'):
            self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
                'repeat_until': False,
                'last_generated_end_datetime': datetime(2019, 6, 27, 8, 0, 0)
            })

            self.assertEqual(len(self.env['project.forecast.recurrency'].search([])), 1)
            self.env['project.forecast.recurrency']._cron_schedule_next()
            self.assertFalse(len(self.env['project.forecast.recurrency'].search([])), 'cron with no forecast gets deleted (there is no original forecast to copy from)')

    def test_forecast_gets_repeated(self):
        """Test forecasts get repeated at the right time

            company_span:           2 weeks

            first run:
                now :                   6/27/2019
                initial_start :         6/27/2019
                repeat_end :            7/11/2019  now + 2 weeks
                generated forecasts:
                                        6/27/2019
                                        7/4/2019
                                        NOT 7/11/2019 because it hits the soft limit

            1st cron
                now :                   7/11/2019  2 weeks later
                last generated start :  7/4/2019
                repeat_end :            7/25/2019  now + 2 weeks
                generated_forecasts:
                                        7/11/2019
                                        7/18/2019
                                        NOT 7/25/2019 because it hits the soft limit

        """
        with self._patch_now('2019-06-27 08:00:00'):
            self._configure_recurrency_span(2, 'week')
            initial_start_dt = datetime(2019, 6, 27, 8, 0, 0)
            initial_end_dt = datetime(2019, 6, 27, 17, 0, 0)
            forecast_values = {
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
            }

            recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
            })
            self.assertFalse(self.get_by_employee(self.employee_joseph))

            # repeat once, since repeat span is two week and there's no repeat until, we should have 2 forecast
            # because we hit the 'soft_limit'
            recurrency.create_forecast(initial_start_dt, initial_end_dt, forecast_values)
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 2, 'initial run should have created 2 forecasts')

            # now run cron two weeks later, should yield two more forecasts
            with self._patch_now('2019-07-11 08:00:00'):
                self.env['project.forecast.recurrency']._cron_schedule_next()
                self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 4, 'first cron run should have geenrated 2 more forecasts')

    def test_forecast_repeat_until_stops_if_not_null_upon_create_repeat(self):
        """create a recurrency with repeat until set which is less than next cron span, should
            stop repeating upon creation

            company_span:           2 weeks

            first run:
                now :                   6/27/2019
                initial_start :         6/27/2019
                repeat_end :            6/29/2019  recurrency's repeat_until
                generated forecasts:
                                        6/27/2019
                                        NOT 7/4/2019 because it hits the recurrency's repeat_until
        """
        with self._patch_now('2019-06-27 08:00:00'):

            self._configure_recurrency_span(2, 'week')
            initial_start_dt = datetime(2019, 6, 27, 8, 0, 0)
            initial_end_dt = datetime(2019, 6, 27, 17, 0, 0)
            forecast_values = {
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
            }

            recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
                'repeat_until': datetime(2019, 6, 29, 8, 0, 0),
            })
            self.assertFalse(self.get_by_employee(self.employee_joseph))

            recurrency.create_forecast(initial_start_dt, initial_end_dt, forecast_values)
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 1, 'first run should only have created 1 forecast since repeat until is set at 1 week')

    def test_forecast_repeat_until_not_null_create_then_cron(self):
        """Create a recurrency with repeat_until set, it allows a full first run, but not on next cron

            first run:
                now :                   6/27/2019
                initial_start :         6/27/2019
                repeat_end :            7/11/2019  recurrency's repeat_until
                generated forecasts:
                                        6/27/2019
                                        7/4/2019
                                        NOT 7/11/2019 because it hits the recurrency's repeat_until

            first cron:
                now:                    7/12/2019
                last generated start:   7/4/2019
                repeat_end:             7/11/2019  still recurrency's repeat_until
                generated forecasts:
                                        NOT 7/11/2019 because it still hits the repeat end
        """
        with self._patch_now('2019-06-27 08:00:00'):
            self._configure_recurrency_span(2, 'week')
            initial_start_dt = datetime(2019, 6, 27, 8, 0, 0)
            initial_end_dt = datetime(2019, 6, 27, 17, 0, 0)
            forecast_values = {
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
            }

            recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
                'repeat_until': datetime(2019, 7, 11, 8, 0, 0),
            })
            self.assertFalse(self.get_by_employee(self.employee_joseph))

            # repeat until is big enough for the first pass to generate all 2 forecasts
            recurrency.create_forecast(initial_start_dt, initial_end_dt, forecast_values)
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 2, 'initial run should have generated 2 forecasts')

            # run the cron, since last generated forecast almost hits the repeat until, there won't be more. still two left
            self.env['project.forecast.recurrency']._cron_schedule_next()
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 2, 'runing the cron right after do not generate new forecasts because of repeat until')

    def test_forecast_repeat_until_not_null_create_then_cron_twice(self):
        """Generate a recurrence with repeat_until that allow first run, then first cron, but shouldn't
            keep generating forecasts on the second

            first run:
                now :                   6/27/2019
                initial_start :         6/27/2019
                repeat_end :            7/25/2019  recurrency's repeat_until (now + 4 weeks)
                generated forecasts:
                                        6/27/2019
                                        7/4/2019

            first cron:
                now:                    7/12/2019  two weeks later
                last generated start:   7/4/2019
                repeat_end:             7/25/2019  still recurrency's repeat_until
                generated forecasts:
                                        7/11/2019
                                        7/18/2019
                                        NOT 7/25/2019 because it hits repeat end

            second cron:
                now:                    7/25/2019  two weeks later
                last generated start:   7/18/2019
                repeat_end:             7/25/2019  still recurrency's repeat_until
                generated forecasts:
                                        NOT 7/25/2019 because it still hits repeat end
        """
        with self._patch_now('2019-06-27 08:00:00'):
            self._configure_recurrency_span(2, 'week')
            initial_start_dt = datetime(2019, 6, 27, 8, 0, 0)
            initial_end_dt = datetime(2019, 6, 27, 17, 0, 0)
            forecast_values = {
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
            }

            recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
                'repeat_until': datetime(2019, 7, 25, 8, 0, 0),
            })
            self.assertFalse(self.get_by_employee(self.employee_joseph))

            # first run, two forecasts generated
            recurrency.create_forecast(initial_start_dt, initial_end_dt, forecast_values)
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 2, 'first run should have geenrated 2 forecasts')
            # run the cron, since last generated forecast do not hit the repeat until, there will be 2 more
        with self._patch_now('2019-07-12 08:00:00'):
            self.env['project.forecast.recurrency']._cron_schedule_next()
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 4, 'first cron should have generated 2 more forecast')
            # run the cron again, since last generated forecast do hit the repeat until, there won't be more
        with self._patch_now('2019-07-25 08:00:00'):
            self.env['project.forecast.recurrency']._cron_schedule_next()
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 4, 'second cron has not generated any foreasts because of repeat until')

    def test_repeat_one_week_at_a_time(self):
        """Since the recurrency cron is meant to run every week, make sure generation works accordingly when
            the company's repeat span is much larger

            first run:
                now :                   6/1/2019
                initial_start :         6/1/2019
                repeat_end :            12/1/2019  initial_start + 6 months
                generated forecasts:
                                        6/1/2019
                                        ...
                                        11/30/2019  (27 items)

            first cron:
                now:                    6/8/2019
                last generated start    11/30/2019
                repeat_end              12/8/2019
                generated forecasts:
                                        12/7/2019

            only one forecast generated: since we are one week later, repeat_end is only one week later and forecasts are generated every week.
            So there is just enough room for one.

            This ensure forecasts are always generated up to x time in advance with x being the company's repeat span

        """
        with self._patch_now('2019-06-01 08:00:00'):
            self._configure_recurrency_span(6, 'month')
            initial_start_dt = datetime(2019, 6, 1, 8, 0, 0)
            initial_end_dt = datetime(2019, 6, 1, 17, 0, 0)
            forecast_values = {
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
            }

            recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
            })
            self.assertFalse(self.get_by_employee(self.employee_joseph))
            recurrency.create_forecast(initial_start_dt, initial_end_dt, forecast_values)
            # over 6 month, we should have generated 27 forecasts
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 27, 'first run has generated 27 forecasts')
            # one week later, always having the forecasts generated 6 months in advance means we
            # have generated one more, which makes 28
        with self._patch_now('2019-06-08 08:00:00'):
            self.env['project.forecast.recurrency']._cron_schedule_next()
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 28, 'second cron only has generated 1 more forecast because of company span')

    def test_repeat_one_week_at_a_time_for_large_interval(self):
        """Since the recurrency cron is meant to run every week, make sure generation works accordingly when
            both the company's repeat span and the repeat interval are much larger

            Company's span is 6 months and repeat_interval is 1 month

            first run:
                now :                   6/1/2019
                initial_start :         6/1/2019
                repeat_end :            12/1/2019  initial_start + 6 months
                generated forecasts:
                                        6/1/2019
                                        ...
                                        11/1/2019  (27 items)

            first cron:
                now:                    6/8/2019
                last generated start    11/30/2019
                repeat_end              12/8/2019
                generated forecasts:
                                        12/1/2019

            second cron:
                now:                    6/15/2019
                last generated start    12/1/2019
                repeat_end              12/15/2019
                generated forecasts:
                                        N/A (we are still 6 months in advance)

        """
        with self._patch_now('2019-06-01 08:00:00'):
            self._configure_recurrency_span(6, 'month')
            initial_start_dt = datetime(2019, 6, 1, 8, 0, 0)
            initial_end_dt = datetime(2019, 6, 1, 17, 0, 0)
            forecast_values = {
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
            }

            recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'month',
            })
            self.assertFalse(self.get_by_employee(self.employee_joseph))
            recurrency.create_forecast(initial_start_dt, initial_end_dt, forecast_values)

            # over 6 month, we should have generated 6 forecasts
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 6, 'first run has generated 6 forecasts')

            # one week later, always having the forecasts generated 6 months in advance means we
            # have generated one more, which makes 7
        with self._patch_now('2019-06-08 08:00:00'):
            self.env['project.forecast.recurrency']._cron_schedule_next()
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 7, 'first cron generated one more forecast')

            # again one week later, we are now up-to-date so there should still be 7 forecasts
        with self._patch_now('2019-06-15 08:00:00'):
            self.env['project.forecast.recurrency']._cron_schedule_next()
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 7, 'second run has not generated any forecats because of company span')

    def test_forecast_remove_after(self):
        with self._patch_now('2019-06-01 08:00:00'):
            self._configure_recurrency_span(6, 'month')
            initial_start_dt = datetime(2019, 6, 1, 8, 0, 0)
            initial_end_dt = datetime(2019, 6, 1, 17, 0, 0)
            forecast_values = {
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
            }

            recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
            })
            self.assertFalse(self.get_by_employee(self.employee_joseph))
            recurrency.create_forecast(initial_start_dt, initial_end_dt, forecast_values)

            # forecasts generated range from 6/1/2019 -> 12/1/2019
            # we'll remove after 6/16/2019, this just leave us with 3 forecasts
            # one on 6/1/2019 and on 6/8/2019 and on 6/15/2019
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 27, 'first run has generated 27 forecasts')
            recurrency.action_remove_after(datetime(2019, 6, 16))
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 3, 'calling remove after on the third forecast removes forecasts [4:]')

    def test_forecast_remove_all(self):
        with self._patch_now('2019-06-01 08:00:00'):
            self._configure_recurrency_span(6, 'month')
            initial_start_dt = datetime(2019, 6, 1, 8, 0, 0)
            initial_end_dt = datetime(2019, 6, 1, 17, 0, 0)
            forecast_values = {
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
            }

            recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
            })
            self.assertFalse(self.get_by_employee(self.employee_joseph))
            recurrency.create_forecast(initial_start_dt, initial_end_dt, forecast_values)

            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 27, 'first run has generated 27 forecasts')
            recurrency.action_remove_all()
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 0, 'calling remove after on any forecast from the recurrency remove all forecasts linked to the recurrency')

    def test_recurrency_has_the_right_company_id(self):
        with self._patch_now('2019-06-01 08:00:00'):
            initial_start_dt = datetime(2019, 6, 1, 8, 0, 0)
            initial_end_dt = datetime(2019, 6, 1, 17, 0, 0)

            initial_company = self.env['res.company'].create({'name': 'original'})
            initial_company.write({
                'forecast_generation_span_interval': 2,
                'forecast_generation_span_uom': 'month',
            })
            initial_recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
                'company_id': initial_company.id,
            })

            initial_recurrency.create_forecast(initial_start_dt, initial_end_dt, {
                'employee_id': self.employee_bert.id,
                'project_id': self.project_opera.id,
            })

            other_company = self.env['res.company'].create({'name': 'other'})
            other_company.write({
                'forecast_generation_span_interval': 1,
                'forecast_generation_span_uom': 'month',
            })
            other_recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
                'company_id': other_company.id,
            })

            other_recurrency.create_forecast(initial_start_dt, initial_end_dt, {
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
            })

            # initial company's recurrency should have created 9 forecasts since it's span is two month
            # other company's recurrency should have create 5 forecasts since it's span is one month
            self.assertEqual(len(self.get_by_employee(self.employee_bert)), 9, 'initial company\'s span is two month, so 9 forecasts')

            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 5, 'other company\'s span is one month, so only 5 forecasts')

    def test_forecast_duplication_dont_duplicate_recurring_forecasts(self):
        """Original week :  6/2/2019 -> 6/8/2019
           Destination week : 6/9/2019 -> 6/15/2019

            forecasts:
                6/2/2019 08:00 -> 6/2/2019 17:00
                6/4/2019 08:00 -> 6/5/2019 17:00
                6/3/2019 08:00 -> 6/3/2019 17:00 --> this one should be recurrent therefore not duplicated
        """
        employee = self.employee_bert
        project = self.project_opera

        fake_recurrency = self.env['project.forecast.recurrency'].create({
            'repeat_interval': 1,
            'repeat_unit': 'week',
        })

        self.env['project.forecast'].create({
            'employee_id': employee.id,
            'project_id': project.id,
            'resource_hours': 8,
            'start_datetime': datetime(2019, 6, 2, 8, 0),
            'end_datetime': datetime(2019, 6, 2, 17, 0),
        })
        self.env['project.forecast'].create({
            'employee_id': employee.id,
            'project_id': project.id,
            'resource_hours': 8,
            'start_datetime': datetime(2019, 6, 4, 8, 0),
            'end_datetime': datetime(2019, 6, 5, 17, 0),
        })

        self.env['project.forecast'].create({
            'employee_id': employee.id,
            'project_id': project.id,
            'resource_hours': 8,
            'start_datetime': datetime(2019, 6, 3, 8, 0),
            'end_datetime': datetime(2019, 6, 3, 17, 0),
            'recurrency_id': fake_recurrency.id
        })

        self.assertEqual(len(self.get_by_employee(employee)), 3)

        self.env['project.forecast'].action_duplicate_period(datetime(2019, 6, 2, 0, 0), datetime(2019, 6, 8, 23, 59), 'week')

        self.assertEqual(len(self.get_by_employee(employee)), 5, 'duplicate has only duplicated forecasts that fit entirely in the period')
        duplicated_forecasts = self.env['project.forecast'].search([
            ('employee_id', '=', employee.id),
            ('project_id', '=', project.id),
            ('start_datetime', '>', datetime(2019, 6, 9, 0, 0)),
            ('end_datetime', '<', datetime(2019, 6, 15, 23, 59)),
        ])
        self.assertEqual(len(duplicated_forecasts), 2, 'duplicate has only duplicated forecasts that fit entirely in the period')

    def test_forecast_detach_if_some_fields_change(self):
        with self._patch_now('2019-06-27 08:00:00'):
            self._configure_recurrency_span(1, 'month')
            initial_start_dt = datetime(2019, 6, 27, 8, 0, 0)
            initial_end_dt = datetime(2019, 6, 27, 17, 0, 0)
            forecast_values = {
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
            }

            recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
            })
            self.assertFalse(self.get_by_employee(self.employee_joseph))

            recurrency.create_forecast(initial_start_dt, initial_end_dt, forecast_values)
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 5)
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), len(recurrency.forecast_ids), 'the recurrency has generated 5 forecasts')

            self.get_by_employee(self.employee_joseph)[0].write({'employee_id': self.employee_bert.id})
            self.assertEqual(len(recurrency.forecast_ids), 4, 'writing on the forecast detach it from the recurrency')

    def test_we_can_attach_an_existing_forecast_to_an_existing_recurrency(self):
        with self._patch_now('2019-06-27 08:00:00'):
            self._configure_recurrency_span(1, 'month')
            initial_start_dt = datetime(2019, 6, 27, 8, 0, 0)
            initial_end_dt = datetime(2019, 6, 27, 17, 0, 0)
            forecast_values = {
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
            }

            recurrency = self.env['project.forecast.recurrency'].create({
                'repeat_interval': 1,
                'repeat_unit': 'week',
            })
            self.assertFalse(self.get_by_employee(self.employee_joseph))

            recurrency.create_forecast(initial_start_dt, initial_end_dt, forecast_values)
            self.assertEqual(len(self.get_by_employee(self.employee_joseph)), 5)

            attached_forecast = self.env['project.forecast'].create({
                'employee_id': self.employee_joseph.id,
                'project_id': self.project_opera.id,
                'start_datetime': datetime(2019, 6, 28, 8, 0),
                'end_datetime': datetime(2019, 6, 28, 17, 0),
                'recurrency_id': recurrency.id,
            })

            self.assertEqual(len(recurrency.forecast_ids), 6, 'there is one more forecast in the recurrency')
            self.assertIn(attached_forecast, recurrency.forecast_ids, 'the attached forecast is in the recurrency')
