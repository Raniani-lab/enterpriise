from odoo import models


class Attendee(models.Model):
    _inherit = 'calendar.attendee'

    def _compute_mail_tz(self):

        toupdate = self.filtered(lambda r: r.event_id.appointment_type_id and r.event_id.appointment_type_id.appointment_tz and r.event_id.appointment_type_id.location)

        for attendee in toupdate:
            attendee.mail_tz = attendee.event_id.appointment_type_id.appointment_tz

        super(Attendee, self - toupdate)._compute_mail_tz()
