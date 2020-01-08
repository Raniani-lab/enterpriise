# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Event(models.Model):
    _inherit = 'event.event'

    # date from which the track gantt view will start, if this event is the active ID
    track_gantt_initial_date = fields.Date(compute='_compute_track_gantt_initial_date')

    @api.depends('track_ids.date', 'date_begin')
    def _compute_track_gantt_initial_date(self):
        for event in self:
            if event.track_ids:
                event.track_gantt_initial_date = min(event.date_begin, *[track.date for track in event.track_ids])
            else:
                event.track_gantt_initial_date = event.date_begin
