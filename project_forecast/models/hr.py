# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

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
