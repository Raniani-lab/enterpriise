# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from collections import defaultdict
from datetime import datetime, timedelta

from dateutil.relativedelta import relativedelta
import base64
import logging
import pytz

from odoo import api, exceptions, fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.osv import expression
from odoo.tools.safe_eval import safe_eval
from odoo import tools

from odoo.addons.project_forecast.models.project_forecast_recurrency import repeat_span_to_relativedelta

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

    # repeat
    recurrency_id = fields.Many2one('project.forecast.recurrency', readonly=True, index=True)

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
        if self.recurrency_id:
            return {
                'warning': {
                    'title': _("Warning"),
                    'message': _("This action will remove the current forecast from the recurrency. Are you sure you want to continue?"),
                }
            }

    @api.onchange('task_id')
    def _onchange_task_id(self):
        if self.task_id:
            self.project_id = self.task_id.project_id
        if self.recurrency_id:
            return {
                'warning': {
                    'title': _("Warning"),
                    'message': _("This action will remove the current forecast from the recurrency. Are you sure you want to continue?"),
                }
            }

    @api.onchange('project_id')
    def _onchange_project_id(self):
        if self.recurrency_id:
            return {
                'warning': {
                    'title': _("Warning"),
                    'message': _("This action will remove the current forecast from the recurrency. Are you sure you want to continue?"),
                }
            }

    # ----------------------------------------------------
    # ORM overrides
    # ----------------------------------------------------

    def write(self, values):
        breaking_fields = self._get_fields_breaking_recurrency()
        for fieldname in breaking_fields:
            if fieldname in values and not values.get('recurrency_id'):
                values.update({'recurrency_id': False})
        if ('published' not in values) and (set(values.keys()) & set(self._get_publish_important_fields())):
            values['published'] = False
        return super().write(values)

    # ----------------------------------------------------
    # Actions
    # ----------------------------------------------------

    @api.model
    def action_duplicate_period(self, start_datetime, end_datetime, interval):
        forecasts_to_duplicate = self.search([('start_datetime', '>=', start_datetime), ('end_datetime', '<=', end_datetime), ('recurrency_id', '=', False)])
        delta = repeat_span_to_relativedelta(1, interval)
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
        start_datetime = fields.Datetime.from_string(start_date.replace('T', ' '))
        end_datetime = fields.Datetime.from_string(end_date.replace('T', ' '))
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
    # Grid View Stuffs
    # ----------------------------------------------------

    @api.multi
    def adjust_grid(self, row_domain, column_field, column_value, cell_field, change):
        """
            Grid range when adjusting does not necessarily match the range of any forecast. Or might match many.
            The strategy here is:
                if adjustement > 0:
                    -try to find a single forecast that perfectly match grid's range and domain, and if found
                     adjust (add) his resource hours
                    -if none or many forecast were found matching the grid's criteria, it is ambiguous and therefore
                     we create a new forecast that fits the range/conditions and give it the whole change as resource_hours
                     user can then modify it in gantt, or it'll fit the previous condition if there was none before
                if we need to substract hours
                    -we find all forecasts that belong to this grid column and repeatedly remove resource_hours from them,
                     deleting the forecast when it's resource hours reach zero.
                    -if the change is more than accumulated forecasts's hours (that mean the user entered a negative number)
                     we raise an exception as this would lead to negatve resource_hours which is contrained as zero or positive
        """
        # find cell values
        employee_id, project_id, task_id = self._adjust_grid_find_relational_values(row_domain)
        start_datetime, end_datetime = self._adjust_grid_get_start_and_end_datetime(column_value)
        existent_forecast = self.search(expression.AND([row_domain, [('start_datetime', '>=', start_datetime)], [('start_datetime', '<=', end_datetime)]]))
        if change > 0:
            # look if we can find one unique forecast in that time span
            if len(existent_forecast) == 1:
                existent_forecast.write({'resource_hours': existent_forecast.resource_hours + change})
            else:
                employee = self.env['hr.employee'].browse([employee_id])
                employee_start, employee_end = employee._get_work_interval(start_datetime, end_datetime).get(employee_id)
                self.create({
                    'start_datetime': employee_start,
                    'end_datetime': employee_end,
                    'employee_id': employee_id,
                    'project_id': project_id,
                    'task_id': task_id,
                    'resource_hours': change,
                })
        else:
            # remove resource hours from last forecast, if it reaches 0 delete the forecast
            self._adjust_grid_remove(existent_forecast, change)

    def _adjust_grid_get_start_and_end_datetime(self, column_value):
        start_datetime = fields.Datetime.from_string(column_value.split('/')[0])
        end_datetime = fields.Datetime.from_string(column_value.split('/')[1]) - relativedelta(seconds=1)
        return (start_datetime, end_datetime)

    def _adjust_grid_find_relational_values(self, row_domain):
        """
            In order to create/edit a forecast we need to find it's employee_id
            and project_id at the very least. If possible task_id should be determined
            as well. Since grid doesn't give it explicitly we look for it in the row_domain.
            If neither employee_id nor project_id is found we raise an exception.
            task_id is not mandatory therefore it might be false.
            Also, since a task might be linked to a project, we try to get the project_id
            from that relation if a task is found but no project

            returns a tuple (employee_id, project_id, task_id=False)
        """
        employee_id = False
        project_id = False
        task_id = False
        for cond in row_domain:
            if((isinstance(cond, list) or isinstance(cond, tuple)) and len(cond) == 3 and cond[1] == '='):
                if cond[0] == 'employee_id':
                    employee_id = cond[2]
                elif cond[0] == 'task_id':
                    task_id = cond[2]
                elif cond[0] == 'project_id':
                    project_id = cond[2]
        # deduct project_id from task_id if feasible
        if (not project_id) and task_id:
            task = self.env['project.task'].browse(task_id)
            if task and task.project_id:
                project_id = task.project_id.id
        # if we do not have enough information, raise
        if((not employee_id) or (not project_id)):
            raise exceptions.UserError(_('can only edit forecasts resource hours if grouped by at least employee and project'))
        return (employee_id, project_id, task_id)

    def _adjust_grid_remove(self, forecasts, change):
        if sum(forecasts.mapped('resource_hours')) < abs(change):
            raise UserError(_('Cannot remove more hours than there actually is'))
        to_remove = abs(change)
        while(to_remove and forecasts):
            act_forecast = forecasts[0]
            delta = min(to_remove, act_forecast.resource_hours)
            to_remove -= delta
            act_forecast.resource_hours -= delta
            if act_forecast.resource_hours == 0:
                forecasts = forecasts - act_forecast
                act_forecast.unlink()


    # ----------------------------------------------------
    #  Mail
    # ----------------------------------------------------

    @api.multi
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
    def _get_fields_breaking_recurrency(self):
        """Returns the list of field which when changed should break the relation of the forecast
            with it's recurrency
        """
        return [
            'employee_id',
            'project_id',
            'task_id'
        ]

    @api.model
    def _get_repeatable_fields(self):
        """
            Returns the name of the fields meant to be cloned between repeated/duplicated forecast
            Allows extending the model without breaking repeating, by adding new fields
            to this list
        """
        return [
            'employee_id',
            'project_id',
            'task_id',
            'resource_hours',
        ]

    def _get_record_repeatable_fields_as_values(self):
        values = {}
        for field_name in self._get_repeatable_fields():
            values[field_name] = self[field_name]
        return self._convert_to_write(values)

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

