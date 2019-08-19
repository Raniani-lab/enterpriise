# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime, timedelta

from dateutil.relativedelta import relativedelta
import logging
import pytz

from odoo import api, exceptions, fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.osv import expression
from odoo import tools


_logger = logging.getLogger(__name__)


class ProjectForecast(models.Model):
    _name = 'project.forecast'
    _description = 'Project Forecast'
    _order = 'end_datetime,id desc'
    _rec_name = 'name'

    def _default_employee_id(self):
        user_id = self.env.context.get('default_user_id', self.env.uid)
        employee_ids = self.env['hr.employee'].search([('user_id', '=', user_id)])
        return employee_ids and employee_ids[0] or False

    def _default_start_datetime(self):
        return fields.Datetime.to_string(datetime.combine(datetime.now(), datetime.min.time()))

    def _default_end_datetime(self):
        return fields.Datetime.to_string(datetime.combine(datetime.now(), datetime.max.time()))

    def _read_group_employee_ids(self, employee, domain, order):
        return self.search(expression.OR([[['create_date', '<', datetime.now()]], domain])).mapped('employee_id')

    name = fields.Char(compute='_compute_name')
    active = fields.Boolean(default=True)
    employee_id = fields.Many2one('hr.employee', "Employee", default=_default_employee_id, required=True, group_expand='_read_group_employee_ids')
    user_id = fields.Many2one('res.users', string="User", related='employee_id.user_id', store=True, readonly=True)
    project_id = fields.Many2one('project.project', string="Project", required=True, domain="[('allow_forecast', '=', True)]")
    task_id = fields.Many2one(
        'project.task', string="Task", domain="[('project_id', '=', project_id)]",
        group_expand='_read_forecast_tasks')
    company_id = fields.Many2one('res.company', string="Company", readonly=True, default=lambda self: self.env.company)

    # used in custom filter
    stage_id = fields.Many2one(related='task_id.stage_id', string="Task stage", readonly=False)
    tag_ids = fields.Many2many(related='task_id.tag_ids', string="Task tags", readonly=False)

    start_datetime = fields.Datetime(required=True, default=_default_start_datetime)
    end_datetime = fields.Datetime(required=True, default=_default_end_datetime)

    # email
    published = fields.Boolean(default=False)

    color = fields.Integer(string="Color", compute='_compute_color')

    # resource
    resource_hours = fields.Float(string="Planned hours", default=0)
    resource_time = fields.Float("Allocated Time (%)", compute='_compute_resource_time', compute_sudo=True, store=True, help="Expressed in the Unit of Measure of the project company")

    _sql_constraints = [
        ('check_start_date_lower_end_date', 'CHECK(end_datetime > start_datetime)', 'Forecast end date should be greater than its start date'),
    ]

    @api.depends('project_id', 'task_id', 'employee_id')
    def _compute_name(self):
        for forecast in self:
            name_parts = []
            if not self.env.context.get('forecast_autocomplete_name'):
                name_parts += [forecast.employee_id.name]
            if forecast.task_id:  # optional field
                name_parts += [forecast.task_id.name]

            name_parts += [forecast.project_id.name, tools.format_duration(forecast.resource_hours)]
            forecast.name = " - ".join(name_parts)

    @api.depends('project_id.color')
    def _compute_color(self):
        for forecast in self:
            forecast.color = forecast.project_id.color or 0

    @api.depends('resource_hours',
                 'start_datetime',
                 'end_datetime',
                 'employee_id',
                 'employee_id.resource_calendar_id')
    def _compute_resource_time(self):
        for forecast in self:
            if(forecast.employee_id and forecast.start_datetime and forecast.end_datetime and forecast.resource_hours):
                available_work_hours = forecast.employee_id._get_work_days_data(forecast.start_datetime, forecast.end_datetime)['hours']
                forecast.resource_time = 100 * forecast.resource_hours
                if available_work_hours:  # avoid division by zero
                    forecast.resource_time = int(forecast.resource_time / available_work_hours)
            else:
                forecast.resource_time = 0.0

    @api.constrains('resource_hours')
    def _check_time_positive(self):
        for forecast in self:
            if forecast.resource_hours and forecast.resource_hours < 0:
                raise ValidationError(_("Forecasted time must be positive"))

    @api.constrains('task_id', 'project_id')
    def _check_task_in_project(self):
        for forecast in self:
            if forecast.task_id and (forecast.task_id not in forecast.project_id.tasks):
                raise ValidationError(_("Your task is not in the selected project."))

    @api.onchange('employee_id')
    def _onchange_employee_id(self):
        if self.employee_id:
            start = self.start_datetime or datetime.combine(datetime.now(), datetime.min.time())
            end = self.end_datetime or datetime.combine(datetime.now(), datetime.max.time())
            work_interval = self.employee_id._get_work_interval(start, end)
            start_datetime, end_datetime = work_interval[self.employee_id.id]
            if start_datetime:
                self.start_datetime = start_datetime.astimezone(pytz.utc).replace(tzinfo=None)
            if end_datetime:
                self.end_datetime = end_datetime.astimezone(pytz.utc).replace(tzinfo=None)

    @api.onchange('task_id')
    def _onchange_task_id(self):
        if self.task_id:
            self.project_id = self.task_id.project_id

    @api.onchange('project_id')
    def _onchange_project_id(self):
        domain = [] if not self.project_id else [('project_id', '=', self.project_id.id)]
        result = {
            'domain': {'task_id': domain},
        }
        if self.task_id:
            self.task_id = False
        return result

    @api.onchange('resource_hours', 'start_datetime', 'end_datetime')
    def _onchange_warn_if_resource_hours_too_long(self):
        if self.employee_id and self.start_datetime and self.end_datetime:
            max_resource_hours = self.employee_id._get_work_days_data(self.start_datetime, self.end_datetime)['hours']
            if self.resource_hours > max_resource_hours:
                return {
                    'warning': {
                        'title': _('Warning!'),
                        'message': _('You are allocating more hours than available for this employee')}
                }

    # ----------------------------------------------------
    # ORM overrides
    # ----------------------------------------------------

    def write(self, values):
        if ('published' not in values) and (set(values.keys()) & set(self._get_publish_important_fields())):
            values['published'] = False
        return super(ProjectForecast, self).write(values)

    # ----------------------------------------------------
    # Actions
    # ----------------------------------------------------

    @api.model
    def action_duplicate_period(self, start_datetime, end_datetime, interval):
        forecasts_to_duplicate = self.search([('start_datetime', '>=', start_datetime), ('end_datetime', '<=', end_datetime)])
        delta = tools.get_timedelta(1, interval)
        list_values = []
        for forecast in forecasts_to_duplicate:
            new_values = forecast._get_record_repeatable_fields_as_values()
            new_values.update({
                'start_datetime': forecast.start_datetime + delta,
                'end_datetime': forecast.end_datetime + delta,
            })
            list_values.append(new_values)
        return self.create(list_values)

    # ----------------------------------------------------
    # Gantt view
    # ----------------------------------------------------

    @api.model
    def gantt_unavailability(self, start_date, end_date, scale, group_bys=None, rows=None):
        start_datetime = fields.Datetime.from_string(start_date)
        end_datetime = fields.Datetime.from_string(end_date)
        employee_ids = set()
        for toplevel_row in rows:
            if toplevel_row.get('records') and 'employee_id' in toplevel_row.get('groupedBy', []):
                for forecast in toplevel_row.get('records'):
                    employee_ids.add(forecast.get('employee_id')[0])
                    toplevel_row['employee_id'] = forecast.get('employee_id')[0]
            elif toplevel_row.get('groupedBy', []) == ['employee_id']:
                employee_ids.add(toplevel_row.get('resId'))
                toplevel_row['employee_id'] = toplevel_row.get('resId')

        employees = self.env['hr.employee'].browse(employee_ids)
        leaves_mapping = employees._get_unavailable_intervals(start_datetime, end_datetime)

        # function to recursively replace subrows with the ones returned by func
        def traverse(func, row):
            new_row = dict(row)
            if new_row.get('employee_id'):
                for sub_row in new_row.get('rows'):
                    sub_row['employee_id'] = new_row['employee_id']
            new_row['rows'] = [traverse(func, row) for row in new_row.get('rows')]
            return func(new_row)

        cell_dt = timedelta(hours=1) if scale == 'day' else timedelta(days=1)
        # for a single row, inject unavailability data
        def inject_unvailabilty(row):
            new_row = dict(row)

            if (not row.get('groupedBy') or row.get('groupedBy')[0] == 'employee_id'):
                employee_id = row.get('employee_id')
                if employee_id:
                    # remove intervals smaller than a cell, as they will cause half a cell to turn grey
                    # ie: when looking at a week, a employee start everyday at 8, so there is a unavailability
                    # like: 2019-05-22 20:00 -> 2019-05-23 08:00 which will make the first half of the 23's cell grey
                    notable_intervals = filter(lambda interval: interval[1] - interval[0] >= cell_dt, leaves_mapping[employee_id])
                    new_row['unavailabilities'] = [{'start': interval[0], 'stop': interval[1]} for interval in notable_intervals]
            return new_row

        return [traverse(inject_unvailabilty, row) for row in rows]

    # ----------------------------------------------------
    #  Mail
    # ----------------------------------------------------

    def action_send(self):
        group_project_user = self.env.ref('project.group_project_user')
        template = self.env.ref('project_forecast.email_template_forecast_single')

        # update context to build a link for view in the forecast
        additionnal_context = {
            'menu_id': str(self.env.ref('project.menu_main_pm').id),
            'action_id': str(self.env.ref('project_forecast.project_forecast_action_by_user').id),
            'dbname': self._cr.dbname,
            'group_project_user_id': self.env.ref('project.group_project_user').id,  # needed to include link to forecast
        }
        forecast_template = template.with_context(**additionnal_context)

        mails_to_send = self.env['mail.mail']
        for forecast in self:
            if forecast.employee_id.work_email:
                mail_id = forecast_template.send_mail(forecast.id, notif_layout='mail.mail_notification_light')
                current_mail = self.env['mail.mail'].browse(mail_id)
                mails_to_send |= current_mail

        if mails_to_send:
            mails_to_send.send()

        self.write({'published': True})

        return {'type': 'ir.actions.act_window_close'}

    # ----------------------------------------------------
    # Business Methods
    # ----------------------------------------------------

    @api.model
    def _read_forecast_tasks(self, tasks, domain, order):
        tasks_domain = [('id', 'in', tasks.ids)]
        if 'default_project_id' in self.env.context:
            tasks_domain = expression.OR([
                tasks_domain,
                [('project_id', '=', self.env.context['default_project_id'])]
            ])
        return tasks.sudo().search(tasks_domain, order=order)

    @api.model
    def _get_publish_important_fields(self):
        return [
            'employee_id',
            'project_id',
            'task_id',
            'resource_hours',
            'start_datetime',
            'end_datetime'
        ]
