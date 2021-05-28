# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class CalendarWebsiteAppointmentShare(models.TransientModel):
    _inherit = 'calendar.appointment.share'

    appointment_type_ids = fields.Many2many(domain=[('is_published', '!=', False)])
