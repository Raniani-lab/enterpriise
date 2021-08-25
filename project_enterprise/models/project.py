# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from pytz import utc
from collections import defaultdict

from odoo import api, fields, models
from odoo.exceptions import UserError
from datetime import timedelta


class Task(models.Model):
    _inherit = "project.task"

    planned_date_begin = fields.Datetime("Start date")
    planned_date_end = fields.Datetime("End date")
    partner_mobile = fields.Char(related='partner_id.mobile', readonly=False)
    partner_zip = fields.Char(related='partner_id.zip', readonly=False)
    partner_street = fields.Char(related='partner_id.street', readonly=False)
    project_color = fields.Integer('Project color', related='project_id.color')

    # Task Dependencies fields
    display_warning_dependency_in_gantt = fields.Boolean(compute="_compute_display_warning_dependency_in_gantt")

    _sql_constraints = [
        ('planned_dates_check', "CHECK ((planned_date_begin <= planned_date_end))", "The planned start date must be prior to the planned end date."),
    ]

    def default_get(self, fields_list):
        result = super().default_get(fields_list)
        planned_date_begin = result.get('planned_date_begin', False)
        planned_date_end = result.get('planned_date_end', False)
        if planned_date_begin and planned_date_end and not self.env.context.get('fsm_mode', False):
            user_id = result.get('user_id', None)
            planned_date_begin, planned_date_end = self._calculate_planned_dates(planned_date_begin, planned_date_end, user_id)
            result.update(planned_date_begin=planned_date_begin, planned_date_end=planned_date_end)
        return result

    def _compute_display_warning_dependency_in_gantt(self):
        for task in self:
            task.display_warning_dependency_in_gantt = not (task.stage_id.is_closed or task.stage_id.fold)

    @api.model
    def _calculate_planned_dates(self, date_start, date_stop, user_id=None, calendar=None):
        if not (date_start and date_stop):
            raise UserError('One parameter is missing to use this method. You should give a start and end dates.')
        start, stop = date_start, date_stop
        if isinstance(start, str):
            start = fields.Datetime.from_string(start)
        if isinstance(stop, str):
            stop = fields.Datetime.from_string(stop)

        if not calendar:
            user = self.env['res.users'].sudo().browse(user_id) if user_id and user_id != self.env.user.id else self.env.user
            calendar = user.resource_calendar_id or self.env.company.resource_calendar_id
            if not calendar:  # Then we stop and return the dates given in parameter.
                return date_start, date_stop

        if not start.tzinfo:
            start = start.replace(tzinfo=utc)
        if not stop.tzinfo:
            stop = stop.replace(tzinfo=utc)

        intervals = calendar._work_intervals_batch(start, stop)[False]
        if not intervals:  # Then we stop and return the dates given in parameter
            return date_start, date_stop
        list_intervals = [(start, stop) for start, stop, records in intervals]  # Convert intervals in interval list
        start = list_intervals[0][0].astimezone(utc).replace(tzinfo=None)  # We take the first date in the interval list
        stop = list_intervals[-1][1].astimezone(utc).replace(tzinfo=None)  # We take the last date in the interval list
        return start, stop

    def write(self, vals):
        compute_default_planned_dates = None
        if not self.env.context.get('fsm_mode', False) and 'planned_date_begin' in vals and 'planned_date_end' in vals:  # if fsm_mode=True then the processing in industry_fsm module is done for these dates.
            compute_default_planned_dates = self.filtered(lambda task: not task.planned_date_begin and not task.planned_date_end)

        res = super().write(vals)

        if compute_default_planned_dates:
            # Take the default planned dates
            planned_date_begin = vals.get('planned_date_begin', False)
            planned_date_end = vals.get('planned_date_end', False)

            # Then sort the tasks by resource_calendar and finally compute the planned dates
            default_calendar = self.env.company.resource_calendar_id

            calendar_by_user_dict = {  # key: user_id, value: resource.calendar instance
                user.id:
                    user.resource_calendar_id or default_calendar
                for user in compute_default_planned_dates.mapped('user_id')
            }

            tasks_by_resource_calendar_dict = defaultdict(lambda: self.env[self._name])  # key = resource_calendar instance, value = tasks
            for task in compute_default_planned_dates:
                if task.user_id:
                    tasks_by_resource_calendar_dict[calendar_by_user_dict[task.user_id.id]] |= task
                else:
                    tasks_by_resource_calendar_dict[default_calendar] |= task
            for (calendar, tasks) in tasks_by_resource_calendar_dict.items():
                date_start, date_stop = self._calculate_planned_dates(planned_date_begin, planned_date_end, calendar=calendar)
                tasks.write({
                    'planned_date_begin': date_start,
                    'planned_date_end': date_stop,
                })
        return res

    # ----------------------------------------------------
    # Gantt view
    # ----------------------------------------------------

    @api.model
    def gantt_unavailability(self, start_date, end_date, scale, group_bys=None, rows=None):
        start_datetime = fields.Datetime.from_string(start_date)
        end_datetime = fields.Datetime.from_string(end_date)
        user_ids = set()

        # function to "mark" top level rows concerning users
        # the propagation of that user_id to subrows is taken care of in the traverse function below
        def tag_user_rows(rows):
            for row in rows:
                group_bys = row.get('groupedBy')
                res_id = row.get('resId')
                if group_bys:
                    # if user_id is the first grouping attribute
                    if group_bys[0] == 'user_id' and res_id:
                        user_id = res_id
                        user_ids.add(user_id)
                        row['user_id'] = user_id
                    # else we recursively traverse the rows
                    elif 'user_id' in group_bys:
                        tag_user_rows(row.get('rows'))

        tag_user_rows(rows)
        resources = self.env['res.users'].browse(user_ids).mapped('resource_ids').filtered(lambda r: r.company_id.id == self.env.company.id)
        # we reverse sort the resources by date to keep the first one created in the dictionary
        # to anticipate the case of a resource added later for the same employee and company
        user_resource_mapping = {resource.user_id.id: resource.id for resource in resources.sorted('create_date', True)}
        leaves_mapping = resources._get_unavailable_intervals(start_datetime, end_datetime)
        company_leaves = self.env.company.resource_calendar_id._unavailable_intervals(start_datetime.replace(tzinfo=utc), end_datetime.replace(tzinfo=utc))

        # function to recursively replace subrows with the ones returned by func
        def traverse(func, row):
            new_row = dict(row)
            if new_row.get('user_id'):
                for sub_row in new_row.get('rows'):
                    sub_row['user_id'] = new_row['user_id']
            new_row['rows'] = [traverse(func, row) for row in new_row.get('rows')]
            return func(new_row)

        cell_dt = timedelta(hours=1) if scale in ['day', 'week'] else timedelta(hours=12)

        # for a single row, inject unavailability data
        def inject_unavailability(row):
            new_row = dict(row)
            user_id = row.get('user_id')
            calendar = company_leaves
            if user_id:
                resource_id = user_resource_mapping.get(user_id)
                if resource_id:
                    calendar = leaves_mapping[resource_id]

            # remove intervals smaller than a cell, as they will cause half a cell to turn grey
            # ie: when looking at a week, a employee start everyday at 8, so there is a unavailability
            # like: 2019-05-22 20:00 -> 2019-05-23 08:00 which will make the first half of the 23's cell grey
            notable_intervals = filter(lambda interval: interval[1] - interval[0] >= cell_dt, calendar)
            new_row['unavailabilities'] = [{'start': interval[0], 'stop': interval[1]} for interval in notable_intervals]
            return new_row

        return [traverse(inject_unavailability, row) for row in rows]
