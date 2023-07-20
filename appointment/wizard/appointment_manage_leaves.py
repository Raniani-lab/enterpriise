# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class AppointmentManageLeaves(models.TransientModel):
    _name = 'appointment.manage.leaves'
    _description = 'Add or remove leaves from appointments'

    appointment_resource_ids = fields.Many2many('appointment.resource', string="Specific Resources")
    calendar_id = fields.Many2one('resource.calendar', string='Resource Calendar')
    leave_start_dt = fields.Datetime('Start Date', required=True)
    leave_end_dt = fields.Datetime('End Date', required=True)
    reason = fields.Char('Reason')

    def action_create_leave(self):
        leave_values = []
        for wizard in self:
            leave_values_common = {
                'date_from': wizard.leave_start_dt,
                'date_to': wizard.leave_end_dt,
                'name': wizard.reason
            }
            if wizard.appointment_resource_ids:
                leave_values += [{
                    'calendar_id': resource.resource_id.calendar_id.id,
                    'resource_id': resource.resource_id.id,
                    **leave_values_common
                } for resource in wizard.appointment_resource_ids]
            else:
                leave_values += [{
                    'calendar_id': wizard.calendar_id.id,
                    **leave_values_common
                }]
        self.env['resource.calendar.leaves'].create(leave_values)
        return {'type': 'ir.actions.act_window_close'}
