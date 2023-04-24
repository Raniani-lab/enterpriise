# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AppointmentBookingLine(models.Model):
    _name = "appointment.booking.line"
    _rec_name = "calendar_event_id"
    _description = "Appointment Booking Line"
    _order = "event_start desc, id desc"

    active = fields.Boolean(related="calendar_event_id.active")
    appointment_resource_id = fields.Many2one('appointment.resource', string="Appointment Resource",
        ondelete="cascade", required=True, readonly=True)
    appointment_type_id = fields.Many2one('appointment.type', related="calendar_event_id.appointment_type_id",
        store=True, readonly=True, ondelete="cascade", index=True)
    capacity_reserved = fields.Integer('Capacity Reserved', default=1, required=True,
        help="Capacity reserved by the user")
    capacity_used = fields.Integer('Capacity Used', default=1, readonly=True, required=True,
        help="Capacity that will be used based on the capacity and resource selected")
    calendar_event_id = fields.Many2one('calendar.event', string="Booking", ondelete="cascade", required=True)
    event_start = fields.Datetime('Booking Start', related="calendar_event_id.start", readonly=True, store=True)
    event_stop = fields.Datetime('Booking End', related="calendar_event_id.stop", readonly=True, store=True)

    _sql_constraints = [
        ('check_capacity_reserved', 'CHECK(capacity_reserved >= 0)', 'The capacity reserved should be positive.'),
        ('check_capacity_used', 'CHECK(capacity_used >= capacity_reserved)', 'The capacity used can not be lesser than the capacity reserved'),
    ]

    @api.constrains('appointment_type_id', 'event_start', 'event_stop', 'appointment_resource_id', 'capacity_reserved')
    def _check_bookings_availability(self):
        """ Check bookings are possible for the time slot and capacity needed """
        meeting_booking_lines = self.grouped('calendar_event_id')
        for meeting, booking_lines in meeting_booking_lines.items():
            remaining_capacity = meeting.appointment_type_id._get_resources_remaining_capacity(
                booking_lines.appointment_resource_id,
                meeting.start,
                meeting.stop,
                with_linked_resources=False,
                resource_to_bookings=booking_lines.grouped('appointment_resource_id'),
            )['total_remaining_capacity']
            if remaining_capacity < 0:
                raise ValidationError(_("The booking linked to the meeting, %s, can't be configured with the values defined. There is not enough capacity available!", meeting.name))
