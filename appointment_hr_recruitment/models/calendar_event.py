# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _

class CalendarEventRecruitment(models.Model):
    _inherit = 'calendar.event'

    applicant_id = fields.Many2one('hr.applicant', compute="_compute_applicant_id", readonly=False, store=True)

    @api.depends('appointment_type_id')
    def _compute_applicant_id(self):
        for event in self:
            if event.appointment_type_id.applicant_id:
                event.applicant_id = event.appointment_type_id.applicant_id

    @api.model_create_multi
    def create(self, vals_list):
        events = super().create(vals_list)
        for event in events:
            if event.applicant_id:
                if not event.applicant_id.appointment_type_id:
                    if event.partner_id.user_ids:
                        user_id = event.partner_id.user_ids[0].id
                    else:
                        user_id = self.env.user.id or event.create_uid.id
                    event.applicant_id.appointment_type_id = self.env['appointment.type'].create({
                        'name': _('Applicant interview : %s', event.applicant_id.partner_name),
                        'applicant_id': event.applicant_id.id,
                        'category': 'custom',
                        'appointment_tz': self.env.user.tz or 'UTC',
                        'staff_user_ids': [user_id]
                    })
                event.appointment_type_id = event.applicant_id.appointment_type_id
        return events
