# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime
from dateutil.relativedelta import relativedelta
import pytz

from odoo import api, exceptions, fields, models, _
from odoo.exceptions import ValidationError


class ProjectForecastCreateWizard(models.TransientModel):
    _name = 'project.forecast.create'
    _description = 'Project Forecast creation wizard'

    def _default_employee_id(self):
        user_id = self.env.context.get('default_user_id', self.env.uid)
        employee_ids = self.env['hr.employee'].search([('user_id', '=', user_id)])
        return employee_ids and employee_ids[0] or False

    employee_id = fields.Many2one(
        'hr.employee',
        "Employee",
        required=True, default=_default_employee_id)
    user_id = fields.Many2one('res.users', string="User", related='employee_id.user_id', store=True, readonly=True)
    project_id = fields.Many2one('project.project', string="Project", required=True, domain="[('allow_forecast', '=', True)]")
    task_id = fields.Many2one(
        'project.task', string="Task", domain="[('project_id', '=', project_id)]")

    # start and end date
    start_datetime = fields.Datetime('Start date', required=True)
    end_datetime = fields.Datetime('End date', required=True)

    # repeat
    repeat = fields.Boolean(string="Repeat")
    repeat_interval = fields.Integer(string="Repeat every", default=1)
    repeat_unit = fields.Selection([
        ('week', 'Week(s)'),
        ('month', 'Month(s)'),
    ], default='week')
    repeat_until = fields.Date()
    recurrency_id = fields.Many2one('project.forecast.recurrency')

    # Autocomplete
    previous_forecast_id = fields.Many2one('project.forecast', string='Recent Forecasts', store=False)
    autocomplete_forecast_ids = fields.Many2many('project.forecast', store=False, compute='_compute_autocomplete_forecast_ids')

    # resource
    resource_hours = fields.Float(string="Planned hours")
    resource_time = fields.Float(string="Allocated Time (%)", compute='_compute_resource_time', compute_sudo=True, help="Expressed in the Unit of Measure of the project company")

    # used to display warning in Form view
    employee_tz_warning = fields.Char(string="", compute='_compute_employee_tz_warning')

    _sql_constraints = [
        ('check_start_date_lower_end_date', 'CHECK(end_datetime > start_datetime)', 'Forecast end date should be greater than its start date'),
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
    @api.depends('resource_hours',
                 'start_datetime',
                 'end_datetime',
                 'employee_id',
                 'employee_id.resource_calendar_id',
                 'employee_id.resource_calendar_id.attendance_ids')
    def _compute_resource_time(self):
        for forecast in self:
            if(forecast.employee_id and forecast.start_datetime and forecast.end_datetime and forecast.resource_hours):
                available_work_hours = forecast.employee_id._get_work_days_data(forecast.start_datetime, forecast.end_datetime)['hours']
                forecast.resource_time = 100 * forecast.resource_hours
                if available_work_hours:  # avoid division by zero
                    forecast.resource_time = int(forecast.resource_time / available_work_hours)

    @api.multi
    @api.depends('employee_id')
    def _compute_employee_tz_warning(self):
        for forecast in self:
            if(forecast.employee_id and self.env.user.tz and forecast.employee_id.tz != self.env.user.tz):
                forecast.employee_tz_warning = _('%s\'s schedules timezone differs from yours' % (forecast.employee_id.name,))
            else:
                forecast.employee_tz_warning = False

    @api.constrains('resource_hours')
    def _check_time_positive(self):
        if self.resource_hours and self.resource_hours < 0:
            raise ValidationError(_("Forecasted time must be positive"))

    @api.constrains('task_id', 'project_id')
    def _check_task_in_project(self):
        if self.task_id and (self.task_id not in self.project_id.tasks):
            raise ValidationError(_("Your task is not in the selected project."))

    @api.onchange('employee_id')
    def _onchange_employee_id(self):
        if self.start_datetime and self.end_datetime:
            context_start = self.start_datetime
            context_end = self.end_datetime

            if context_start.day == context_end.day:  # schedule one hour
                self.start_datetime = context_start
                self.end_datetime = self.start_datetime + relativedelta(hours=1)
            else:  # we should schedule a full employee's day
                if self.employee_id:
                    work_interval = self.employee_id._get_work_interval(context_start, context_end)
                    start_datetime, end_datetime = work_interval[self.employee_id.id]
                    if start_datetime:
                        self.start_datetime = start_datetime.astimezone(pytz.utc).replace(tzinfo=None)
                    if end_datetime:
                        self.end_datetime = end_datetime.astimezone(pytz.utc).replace(tzinfo=None)

    @api.onchange('task_id')
    def _onchange_task_id(self):
        if self.task_id and not self.project_id:
            self.project_id = self.task_id.project_id

    @api.onchange('project_id')
    def _onchange_project_id(self):
        domain = [] if not self.project_id else [('project_id', '=', self.project_id.id)]
        return {
            'domain': {'task_id': domain},
        }

    @api.onchange('start_datetime', 'end_datetime', 'employee_id')
    def _onchange_resource_hours(self):
        if self.employee_id and self.start_datetime and self.end_datetime:
            self.resource_hours = self.employee_id._get_work_days_data(self.start_datetime, self.end_datetime)['hours']

    @api.onchange('resource_hours')
    def _onchange_warn_if_resource_hours_too_long(self):
        if self.employee_id and self.start_datetime and self.end_datetime:
            max_resource_hours = self.employee_id._get_work_days_data(self.start_datetime, self.end_datetime)['hours']
            if self.resource_hours > max_resource_hours:
                return {
                    'warning': {
                        'title': _('Warning!'),
                        'message': _('You are allocating more hours than available for this employee')}
                }

    @api.onchange('previous_forecast_id')
    def _onchange_previous_forecast_id(self):
        if self.previous_forecast_id and self.start_datetime:
            interval = self.previous_forecast_id.end_datetime - self.previous_forecast_id.start_datetime
            self.employee_id = self.previous_forecast_id.employee_id
            self.project_id = self.previous_forecast_id.project_id
            self.task_id = self.previous_forecast_id.task_id
            self.end_datetime = self.start_datetime + interval

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
        return {
            'employee_id': self.employee_id.id,
            'user_id': self.user_id.id,
            'project_id': self.project_id.id,
            'task_id': self.task_id.id,
            'resource_hours': self.resource_hours,
            'start_datetime': self.start_datetime,
            'end_datetime': self.end_datetime,
        }

    def _prepare_recurrency_values(self):
        return {
            'repeat': self.repeat,
            'repeat_interval': self.repeat_interval,
            'repeat_unit': self.repeat_unit,
            'repeat_until': self.repeat_until,
            'company_id': self.env.company.id,
        }
