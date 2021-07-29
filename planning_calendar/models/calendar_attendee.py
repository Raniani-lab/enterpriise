# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from pytz import timezone, UTC

from odoo import fields, models
from odoo.tools.misc import clean_context


class CalendarAttendee(models.Model):
    _inherit = 'calendar.attendee'

    planning_slot_ids = fields.One2many('planning.slot', 'attendee_id')

    def write(self, vals):
        res = super().write(vals)
        if vals.get('state') == 'declined':
            self.sudo().planning_slot_ids.unlink()
        return res

    def unlink(self):
        self.planning_slot_ids.sudo().unlink()
        return super().unlink()

    def _create_planning_slots(self):
        meeting_role = self.env.ref('planning_calendar.planning_role_meeting').id
        model_blacklist = self.env['planning.slot']._get_calendar_model_blacklist()

        create_vals = []
        attendees_filtered = self.filtered(lambda a: a.state == 'accepted' and a.event_id.show_as == 'busy' and not a.planning_slot_ids and a.partner_id.user_ids.employee_id and a.event_id.res_model not in model_blacklist)
        for attendee in attendees_filtered:
            start = attendee.event_id.start
            stop = attendee.event_id.stop
            employee = attendee.partner_id.user_ids.employee_id

            if attendee.event_id.allday:
                start = timezone(employee.tz).localize(datetime.combine(
                    start, datetime.min.time())).astimezone(UTC).replace(tzinfo=None)
                stop = timezone(employee.tz).localize(datetime.combine(
                    stop, datetime.max.time())).astimezone(UTC).replace(tzinfo=None)

            create_vals.append({
                'resource_id': employee.resource_id.id,
                'role_id': meeting_role,
                'start_datetime': start,
                'end_datetime': stop,
                'state': 'published',
                'calendar_event_id': attendee.event_id.id,
                'attendee_id': attendee.id,
                'company_id': employee.company_id.id,
                'name': attendee.event_id.name if attendee.event_id.privacy == 'public' else False,
            })

        ctx = clean_context(self.env.context)
        slots = self.env['planning.slot'].with_context(ctx).sudo().create(create_vals)
        slots.action_publish()

        return slots
