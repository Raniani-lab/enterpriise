# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import itertools
import pytz

from odoo import api, fields, models

from odoo.addons.resource.models.resource_mixin import timezone_datetime


class Employee(models.Model):
    _inherit = "hr.employee"

    def _get_work_interval(self, start, end):
        """Return interval's start datetime for interval closest to start. And interval's end datetime for interval closest to end.
            If none is found return None

            :start: datetime
            :end: datetime
            :return: (datetime|None, datetime|None)
        """
        start_datetime = timezone_datetime(start)
        end_datetime = timezone_datetime(end)
        employee_mapping = {}
        for employee in self:
            work_intervals = sorted(
                employee.resource_calendar_id._work_intervals(start_datetime, end_datetime, employee.resource_id),
                key=lambda x: x[0]
            )
            if work_intervals:
                employee_mapping[employee.id] = (work_intervals[0][0].astimezone(pytz.utc), work_intervals[-1][1].astimezone(pytz.utc))
            else:
                employee_mapping[employee.id] = (None, None)
        return employee_mapping

    def _get_unavailable_intervals(self, start, end):
        """Compute the intervals during which employee is unavailable with hour granularity between start and end
        """
        start_datetime = timezone_datetime(start)
        end_datetime = timezone_datetime(end)
        employee_mapping = {}
        for employee in self:
            calendar = employee.resource_calendar_id
            resource = employee.resource_id
            employee_work_intervals = calendar._work_intervals(start_datetime, end_datetime, resource)
            employee_work_intervals = [(start, stop) for start, stop, meta in employee_work_intervals]
            # start + flatten(intervals) + end
            employee_work_intervals = [start_datetime] + list(itertools.chain.from_iterable(employee_work_intervals)) + [end_datetime]
            # put it back to UTC
            employee_work_intervals = list(map(lambda dt: dt.astimezone(pytz.utc), employee_work_intervals))
            # pick groups of two
            employee_work_intervals = list(zip(employee_work_intervals[0::2], employee_work_intervals[1::2]))
            employee_mapping[employee.id] = employee_work_intervals
        return employee_mapping
