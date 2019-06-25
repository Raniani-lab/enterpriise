# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ProjectForecastCreateWizard(models.TransientModel):
    _name = 'project.forecast.create'
    _inherit = 'project.forecast'
    _description = 'Project Forecast creation wizard'

    # Recurrence fields
    repeat = fields.Boolean(string="Repeat")
    repeat_interval = fields.Integer(string="Repeat every", default=1)
    repeat_unit = fields.Selection([
        ('week', 'Week(s)'),
        ('month', 'Month(s)'),
    ], default='week')
    repeat_until = fields.Date("Repeat Until", help="If set, the recurrence stop at that date. Otherwise, the recurrence is applied indefinitely.")

    # Autocomplete fields
    previous_forecast_id = fields.Many2one('project.forecast', string='Recent Forecasts', store=False)
    autocomplete_forecast_ids = fields.Many2many('project.forecast', store=False, compute='_compute_autocomplete_forecast_ids')

    # Used to display warning in Form view
    employee_tz_warning = fields.Char(string="Timezone Warning", compute='_compute_employee_tz_warning')

    _sql_constraints = [
        ('check_end_date_lower_repeat_until', 'CHECK(repeat_until IS NULL OR end_datetime < repeat_until)', 'Forecast should end before the repeat ends'),
    ]

    @api.depends('employee_id')
    def _compute_autocomplete_forecast_ids(self):
        """Computes a list of forecasts that could be used to complete the creation wizard
            forecasts must
                -be assigned to the same employee
                -have distinct projects
            they are ordered by their end_datetime (most recent first)
        """
        if self.employee_id:
            forecasts = self.env['project.forecast'].search([
                ['employee_id', '=', self.employee_id.id]
            ], order='end_datetime')
            seen = {}

            def filter_func(forecast):
                uniq = seen.get(forecast.project_id, True)
                seen[forecast.project_id] = False
                return uniq

            forecasts = forecasts.filtered(filter_func)
            self.autocomplete_forecast_ids = forecasts

    @api.multi
    @api.depends('employee_id')
    def _compute_employee_tz_warning(self):
        for forecast in self:
            if(forecast.employee_id and self.env.user.tz and forecast.employee_id.tz != self.env.user.tz):
                forecast.employee_tz_warning = _('%s\'s schedules timezone differs from yours' % (forecast.employee_id.name,))
            else:
                forecast.employee_tz_warning = False

    @api.onchange('previous_forecast_id')
    def _onchange_previous_forecast_id(self):
        if self.previous_forecast_id and self.start_datetime:
            interval = self.previous_forecast_id.end_datetime - self.previous_forecast_id.start_datetime
            self.end_datetime = self.start_datetime + interval

            self.employee_id = self.previous_forecast_id.employee_id
            self.project_id = self.previous_forecast_id.project_id
            self.task_id = self.previous_forecast_id.task_id
            self.resource_hours = self.previous_forecast_id.resource_hours

    @api.multi
    def action_save_and_send(self):
        """
            we have a different send function to use with the save & send button, that's because
            forecast could have been repeated when created, we have to find related ones so that
            they are sent as well
        """
        related_forecasts = self.create_new()
        for forecast in related_forecasts:
            forecast.action_send()

    def action_create_new(self):
        self.ensure_one()
        forecasts = []
        forecast_values = self._prepare_forecast_values()
        recurrency_values = self._prepare_recurrency_values()
        if self.repeat:
            recurrency = self.env['project.forecast.recurrency'].create(recurrency_values)
            forecasts = recurrency.create_forecast(
                self.start_datetime,
                self.end_datetime,
                forecast_values,
                recurrency.repeat_until
            )
            if not forecasts:
                forecast_values.update({'recurrency_id': recurrency.id})
                forecasts = self.env['project.forecast'].create(forecast_values)
        else:
            forecasts = self.env['project.forecast'].create(forecast_values)
        return forecasts

    def _prepare_forecast_values(self):
        result = {}
        for fname, field in self.env['project.forecast']._fields.items():
            if field.compute is None and not field.related:  # related and computed fields can not be written
                result[fname] = self[fname]
        return self._convert_to_write(result)

    def _prepare_recurrency_values(self):
        return {
            'repeat': self.repeat,
            'repeat_interval': self.repeat_interval,
            'repeat_unit': self.repeat_unit,
            'repeat_until': self.repeat_until,
            'company_id': self.env.company.id,
        }
