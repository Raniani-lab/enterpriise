# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _


def repeat_span_to_relativedelta(span_qty, span_uom):
    """
        Given a string uom in ['day', 'week', 'month', 'year']
        and a positive integer qty returns a relativedelta objects
        of the corresponding length.
    """
    switch = {
        'day': relativedelta(days=span_qty),
        'week': relativedelta(weeks=span_qty),
        'month': relativedelta(months=span_qty),
        'year': relativedelta(years=span_qty),
    }
    return switch[span_uom]


class ForecastRecurrency(models.Model):
    _name = "project.forecast.recurrency"
    _description = "Recurent forecasts definition"

    forecast_ids = fields.One2many('project.forecast', 'recurrency_id', string="Related forecasts", help="Forecasts that were created using this recurrency")
    repeat_interval = fields.Integer("Repeat every", default=1, required=True)
    repeat_unit = fields.Selection([
        ('week', 'Weeks'),
        ('month', 'Months'),
    ], default='week', required=True)
    repeat_until = fields.Datetime(string="Repeat until", help="Up to which date should the forecasts be repeated")
    last_generated_end_datetime = fields.Datetime("Last Generated End Date", readonly=False)
    company_id = fields.Many2one('res.company', string="Company", store=True, readonly=True, default=lambda self: self.env.company)

    _sql_constraints = [
        ('check_repeat_interval_positive', 'CHECK(repeat_interval >= 1)', 'Recurrency repeat interval should be at least 1'),
    ]

    def name_get(self):
        result = []
        repeat_unit_label_map = dict(self.env['project.forecast.recurrency']._fields['repeat_unit']._description_selection(self.env))
        for recurrency in self:
            translated_label = repeat_unit_label_map[recurrency.repeat_unit]
            result.append([
                recurrency.id,
                _('Every %s %s until %s') % (
                    translated_label,
                    recurrency.repeat_unit,
                    recurrency.repeat_until,
                )])
        return result

    def create_forecast(self, initial_start_dt, initial_end_dt, forecast_values, repeat_limit_dt=False):
        """
            Repeatedly create forecast from an existing recurrency
        """
        value_list = []
        repeat_interval_map = self._get_repeat_delta()
        repeat_end_map = self._get_repeat_ends(initial_start_dt, repeat_limit_dt)
        for recurrency in self:
            # initialize forecast creation based on previous forecast
            delta = repeat_interval_map[recurrency.id]
            repeat_until = repeat_end_map[recurrency.id]
            act_start, act_end = initial_start_dt, initial_end_dt
            # create forecasts until we reach repeat_until
            while(act_end < repeat_until):
                new_forecast_values = dict(forecast_values)
                new_forecast_values.update({
                    'start_datetime': act_start,
                    'end_datetime': act_end,
                    'recurrency_id': recurrency.id,
                    'company_id': self.company_id.id,
                })
                value_list.append(new_forecast_values)
                act_start, act_end = act_start + delta, act_end + delta
            recurrency.write({'last_generated_end_datetime': act_end - delta})
        return self.env['project.forecast'].create(value_list)

    def _get_repeat_delta(self):
        deltas = {}
        for recurrency in self:
            deltas[recurrency.id] = repeat_span_to_relativedelta(recurrency.repeat_interval, recurrency.repeat_unit)
        return deltas

    def _get_repeat_ends(self, initial_start_dt=False, repeat_limit_dt=False):
        repeat_ends = {}
        repeat_limit_dt = repeat_limit_dt or datetime.max
        for recurrency in self:
            company_span = repeat_span_to_relativedelta(
                recurrency.company_id.forecast_generation_span_interval,
                recurrency.company_id.forecast_generation_span_uom,
            )
            limit = fields.Datetime.now() + company_span
            recurrency_limit = recurrency.repeat_until or datetime.max
            repeat_ends[recurrency.id] = min(repeat_limit_dt, limit, recurrency_limit)
        return repeat_ends

    def action_remove_after(self, when):
        for recurrency in self:
            forecasts = self.env['project.forecast'].search(['&', ('recurrency_id', '=', recurrency.id), ('start_datetime', '>=', when)])
            forecasts.unlink()
            if len(recurrency.forecast_ids) == 0:
                recurrency.unlink()
            else:
                recurrency.write({'repeat_until': when})

    def action_remove_all(self):
        for recurrency in self:
            recurrency.forecast_ids.unlink()
            recurrency.unlink()

    @api.model
    def _cron_schedule_next(self):
        Recurrency = self.env['project.forecast.recurrency']
        Forecast = self.env['project.forecast']

        companies = self.env['res.company'].search([])
        for company in companies:
            forecast_generation_span_interval = company.forecast_generation_span_interval
            forecast_generation_span_uom = company.forecast_generation_span_uom
            delta = repeat_span_to_relativedelta(forecast_generation_span_interval, forecast_generation_span_uom)

            recurrencies = Recurrency.search([
                '&',
                '&',
                ('company_id', '=', company.id),
                ('last_generated_end_datetime', '<', fields.Datetime.now() + delta),
                '|',
                ('repeat_until', '=', False),
                ('repeat_until', '>', fields.Datetime.now() - delta),
            ])
            repeat_interval_map = recurrencies._get_repeat_delta()
            repeat_end_map = recurrencies._get_repeat_ends()
            for recurrency in recurrencies:
                last_forecast = recurrency.forecast_ids.sorted(key=lambda x: x.end_datetime)
                if last_forecast:
                    last_forecast = last_forecast[-1]
                    repeat_interval = repeat_interval_map.get(recurrency.id)
                    act_start = last_forecast.start_datetime + repeat_interval
                    act_end = last_forecast.end_datetime + repeat_interval
                    values = []
                    while(act_end < repeat_end_map.get(recurrency.id)):
                        new_values = last_forecast._get_record_repeatable_fields_as_values()
                        new_values.update({
                            'start_datetime': act_start,
                            'end_datetime': act_end,
                            'recurrency_id': recurrency.id,
                            'company_id': recurrency.company_id.id,
                        })
                        values.append(new_values)
                        act_start, act_end = act_start + repeat_interval, act_end + repeat_interval

                    Forecast.create(values)
                    recurrency.write({'last_generated_end_datetime': act_end - repeat_interval})
                else:
                    recurrency.unlink()
