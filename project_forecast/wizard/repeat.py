# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError

from odoo.addons.project_forecast.models.project_forecast_recurrency import repeat_span_to_relativedelta


class ProjectForecastRepeatWizard(models.TransientModel):
    _name = 'project.forecast.repeat'
    _description = 'Wizard to repeat an existing forecast'

    @api.model
    def default_get(self, fields):
        result = super(ProjectForecastRepeatWizard, self).default_get(fields)

        if 'related_forecast_id' in fields:
            active_model = self._context.get('active_model')
            if active_model != 'project.forecast':
                raise UserError(_("You can only apply this action from a forecast."))
            result['related_forecast_id'] = self._context.get('active_id')

        return result

    repeat_interval = fields.Integer(string="Repeat every", required=True, default=1)
    repeat_unit = fields.Selection([
        ('week', 'Weeks'),
        ('month', 'Months'),
    ], default="week", required=True)
    repeat_until = fields.Date()
    related_forecast_id = fields.Many2one("project.forecast", readonly=True)

    @api.constrains('related_forecast_id')
    def _check_related_forecast_not_already_recurrent(self):
        if self.related_forecast_id.recurrency_id:
            raise ValidationError(_("Cannot repeat an already repeating forecast"))

    def action_repeat(self):
        self.ensure_one()
        if not (self.repeat_until and self.related_forecast_id.end_datetime >= datetime.combine(self.repeat_until, datetime.min.time())):
            # set the values to  a new forecast that would be the first repeat of the original one
            delta = repeat_span_to_relativedelta(self.repeat_interval, self.repeat_unit)
            forecast_values = self.related_forecast_id._get_record_repeatable_fields_as_values()
            start_datetime = self.related_forecast_id.start_datetime + delta
            end_datetime = self.related_forecast_id.end_datetime + delta
            # use the repeat params from the wizard and create them in repeat
            recurrency_values = {
                'repeat_until': self.repeat_until,
                'repeat_interval': self.repeat_interval,
                'repeat_unit': self.repeat_unit,
                'forecast_ids': [(4, self.related_forecast_id.id, False)],
                'company_id': self.related_forecast_id.company_id.id or self.env.company.id,
            }
            recurrency = self.env['project.forecast.recurrency'].create(recurrency_values)
            return recurrency.create_forecast(start_datetime, end_datetime, forecast_values, recurrency.repeat_until)
