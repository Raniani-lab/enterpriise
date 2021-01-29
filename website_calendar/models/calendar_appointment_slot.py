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
    ], string='Week Day', required=True)
    hour = fields.Float('Starting Hour', required=True, default=8.0)

    @api.constrains('hour')
    def check_hour(self):
        if any(slot.hour < 0.00 or slot.hour >= 24.00 for slot in self):
            raise ValidationError(_("Please enter a valid hour between 0:00 and 24:00 for your slots."))

    def name_get(self):
        weekdays = dict(self._fields['weekday'].selection)
        return self.mapped(lambda slot: (slot.id, "%s, %02d:%02d" % (weekdays.get(slot.weekday), int(slot.hour), int(round((slot.hour % 1) * 60)))))
