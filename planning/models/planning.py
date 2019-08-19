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
from odoo.tools import format_time

_logger = logging.getLogger(__name__)


class Planning(models.Model):
    _name = 'planning.slot'
    _description = 'Planning Shift'
    _order = 'start_datetime,id desc'
    _rec_name = 'name'

    def _default_employee_id(self):
        return self.env.user.employee_id

    def _default_start_datetime(self):
        return fields.Datetime.to_string(datetime.combine(fields.Datetime.now(), datetime.min.time()))

    def _default_end_datetime(self):
        return fields.Datetime.to_string(datetime.combine(fields.Datetime.now(), datetime.max.time()))

    name = fields.Text('Note')
    employee_id = fields.Many2one('hr.employee', "Employee", default=_default_employee_id)
    user_id = fields.Many2one('res.users', string="User", related='employee_id.user_id', store=True, readonly=True)
    company_id = fields.Many2one('res.company', string="Company", required=True, default=lambda self: self.env.company)
    role_id = fields.Many2one('planning.role', string="Role")
    color = fields.Integer("Color", related='role_id.color')

    recurrency_id = fields.Many2one('planning.recurrency', readonly=True, index=True, copy=False)

    start_datetime = fields.Datetime("Start Date", required=True, default=_default_start_datetime)
    end_datetime = fields.Datetime("End Date", required=True, default=_default_end_datetime)

    # forecast allocation
    allocated_hours = fields.Float("Allocated hours", default=0)
    allocated_percentage = fields.Float("Allocated Time (%)", compute='_compute_allocated_percentage', compute_sudo=True, store=True, help="Expressed in the Unit of Measure of the project company")

    _sql_constraints = [
        ('check_start_date_lower_end_date', 'CHECK(end_datetime > start_datetime)', 'Shift end date should be greater than its start date'),
        ('check_allocated_hours_positive', 'CHECK(allocated_hours >= 0)', 'You cannot have negative shift'),
    ]

    @api.depends('allocated_hours', 'start_datetime', 'end_datetime', 'employee_id.resource_calendar_id')
    def _compute_allocated_percentage(self):
        for planning in self:
            if planning.employee_id:
                hours = planning.employee_id._get_work_days_data(planning.start_datetime, planning.end_datetime, compute_leaves=True)['hours']
                if hours > 0:
                    planning.allocated_percentage = planning.allocated_hours * 100.0 / hours
                else:
                    planning.allocated_percentage = 0  # allow to create a forecast for a day you are not supposed to work
            else:
                planning.allocated_percentage = 0

    @api.onchange('employee_id')
    def _onchange_employee_id(self):
        if self.employee_id:
            start = self.start_datetime or datetime.combine(fields.Datetime.now(), datetime.min.time())
            end = self.end_datetime or datetime.combine(fields.Datetime.now(), datetime.max.time())
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
                    'message': _("This action will remove the current shift from the recurrency. Are you sure you want to continue?"),
                }
            }

    @api.onchange('employee_id', 'start_datetime', 'end_datetime')
    def _onchange_employee_and_dates(self):
        if self.employee_id and self.start_datetime and self.end_datetime:
            self.allocated_hours = self.employee_id._get_work_days_data(self.start_datetime, self.end_datetime, compute_leaves=True)['hours']

    # ----------------------------------------------------
    # ORM overrides
    # ----------------------------------------------------

    def name_get(self):
        group_by = self.env.context.get('group_by', [])
        field_list = [fname for fname in self._name_get_fields() if fname not in group_by][:2]  # limit to 2 labels

        result = []
        for slot in self:
            # label part, depending on context `groupby`
            name = ' - '.join([self._fields[fname].convert_to_display_name(slot[fname], slot) for fname in field_list if slot[fname]])

            # date / time part
            destination_tz = pytz.timezone(self.env.user.tz or 'UTC')
            start_datetime = pytz.utc.localize(slot.start_datetime).astimezone(destination_tz).replace(tzinfo=None)
            end_datetime = pytz.utc.localize(slot.end_datetime).astimezone(destination_tz).replace(tzinfo=None)
            if slot.end_datetime - slot.start_datetime <= timedelta(hours=24):  # shift on a single day
                name = '%s - %s %s' % (
                    format_time(self.env, start_datetime.time(), time_format='short'),
                    format_time(self.env, end_datetime.time(), time_format='short'),
                    name
                )
            else:
                name = '%s - %s %s' % (
                    start_datetime.date(),
                    end_datetime.date(),
                    name
                )

            # add unicode bubble to tell there is a note
            if slot.name:
                name = u'%s \U0001F4AC' % name

            result.append([slot.id, name])
        return result

    def write(self, values):
        # detach planning entry from recurrency
        breaking_fields = self._get_fields_breaking_recurrency()
        for fieldname in breaking_fields:
            if fieldname in values and not values.get('recurrency_id'):
                values.update({'recurrency_id': False})
        return super(Planning, self).write(values)

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
                for slot in toplevel_row.get('records'):
                    if slot.get('employee_id'):
                        employee_ids.add(slot.get('employee_id')[0])
                        toplevel_row['employee_id'] = slot.get('employee_id')[0]
            elif toplevel_row.get('groupedBy', []) == ['employee_id'] and toplevel_row.get('resId'):
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
        def inject_unavailability(row):
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

        return [traverse(inject_unavailability, row) for row in rows]

    # ----------------------------------------------------
    # Business Methods
    # ----------------------------------------------------
    @api.model
    def _name_get_fields(self):
        """ List of fields that can be displayed in the name_get """
        return ['employee_id', 'role_id']

    @api.model
    def _get_fields_breaking_recurrency(self):
        """Returns the list of field which when changed should break the relation of the forecast
            with it's recurrency
        """
        return [
            'employee_id',
            'role_id',
        ]


class PlanningRole(models.Model):
    _name = 'planning.role'
    _description = "Planning Role"
    _order = 'name,id desc'
    _rec_name = 'name'

    name = fields.Char('Name', required=True)
    color = fields.Integer("Color", default=0)
