# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class CalendarAppointmentSlot(models.Model):
    _name = "calendar.appointment.slot"
    _description = "Online Appointment : Time Slot"
    _rec_name = "weekday"
    _order = "weekday, hour"

    appointment_type_id = fields.Many2one('calendar.appointment.type', 'Appointment Type', ondelete='cascade')
    weekday = fields.Selection([
        ('1', 'Monday'),
        ('2', 'Tuesday'),
        ('3', 'Wednesday'),
        ('4', 'Thursday'),
        ('5', 'Friday'),
        ('6', 'Saturday'),
        ('7', 'Sunday'),
    ], string='Week Day', required=True, default='1')
    hour = fields.Float('Starting Hour', required=True, default=8.0)
    end_hour = fields.Float('Ending Hour', required=True, default=17.0)

    @api.constrains('hour')
    def check_hour(self):
        if any(slot.hour < 0.00 or slot.hour >= 24.00 for slot in self):
            raise ValidationError(_("Please enter a valid hour between 0:00 and 24:00 for your slots."))

    @api.constrains('hour', 'end_hour')
    def check_delta_hours(self):
        if any(self.filtered(lambda slot: slot.hour >= slot.end_hour)):
            raise ValidationError(_(
                "At least one slot duration from start to end is invalid: a slot should end after start"
            ))
        if not any(self.filtered(lambda slot: slot.end_hour >= slot.hour + slot.appointment_type_id.appointment_duration)):
            raise ValidationError(_(
                "At least one slot duration is not enough to create a slot with the duration set in the appointment type"
            ))

    def name_get(self):
        weekdays = dict(self._fields['weekday'].selection)
        return self.mapped(lambda slot: (slot.id, "%s, %02d:%02d" % (weekdays.get(slot.weekday), int(slot.hour), int(round((slot.hour % 1) * 60)))))
