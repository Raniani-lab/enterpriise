# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class CalendarAppointmentType(models.Model):
    _inherit = "appointment.type"

    applicant_id = fields.Many2one('hr.applicant',
        help="Link an applicant to the appointment type created.\n"
            "Used when creating a custom appointment type from the Meeting action in the applicant form view.")
