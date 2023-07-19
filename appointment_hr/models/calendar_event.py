# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import pytz

from odoo import api, fields, models


class CalendarEvent(models.Model):
    _inherit = "calendar.event"

    @api.model
    def gantt_unavailability(self, start_date, end_date, scale, group_bys=None, rows=None):
        # skip if not dealing with appointments
        user_ids = [row['resId'] for row in rows if row.get('resId')]  # remove empty rows
        if not group_bys or group_bys[0] != 'user_id' or not user_ids:
            return super().gantt_unavailability(start_date, end_date, scale, group_bys=group_bys, rows=rows)

        start_datetime = pytz.utc.localize(fields.Datetime.from_string(start_date))
        end_datetime = pytz.utc.localize(fields.Datetime.from_string(end_date))

        user_ids = self.env['res.users'].browse(user_ids)
        employee_unavailabilities = user_ids.employee_id.resource_calendar_id._unavailable_intervals_batch(
            start_datetime, end_datetime,
            resources=user_ids.employee_id.resource_id
        )
        for row in rows:
            user_id = user_ids.browse(row.get('resId'))
            row['unavailabilities'] = [{'start': start, 'stop': stop}
                                       for start, stop in employee_unavailabilities.get(user_id.employee_id.resource_id.id, [])]
        return rows
