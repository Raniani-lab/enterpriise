# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.addons.google_calendar.utils.google_calendar import GoogleCalendarService


class CalendarEvent(models.Model):
    _inherit = "calendar.event"

    def write(self, vals):
        # When the google_id is set on the Odoo event (which means the related Google Calendar event has been created),
        # sync the Odoo event to the Google calendar event to retrieve the Google Meet url.
        if 'google_id' in vals and not 'videocall_location' in vals:
            for event in self.filtered(lambda event: event.videocall_source == 'google_meet' and not event.videocall_location):
                self.env.user._sync_single_event(GoogleCalendarService(self.env['google.service']), event, vals['google_id'])
        return super().write(vals)
