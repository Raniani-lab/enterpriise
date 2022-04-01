# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools import populate


class AppointmentType(models.Model):
    _inherit = "appointment.type"

    def _populate(self, size):
        appointment_types = super()._populate(size)
        rand = populate.Random('appointment_type+work_hours')

        # Create work_hours appointment types for 30% of active employees
        staff_user_ids = self.env['res.users'].browse(
            self.env.registry.populated_models['res.users']).filtered_domain([('active', '=', True)])

        appointment_types_work_hours = []
        for user_id in staff_user_ids:
            if user_id.with_company(user_id.company_id).employee_id and rand.random() > 0.7:
                appointment_types_work_hours.append({
                    'staff_user_ids': user_id,
                    'appointment_tz': user_id.tz,
                    'category': 'work_hours',
                    'max_schedule_days': 30,
                    'name': f'Meeting with {user_id.name}',
                    'slot_ids': [(0, 0, {
                        'weekday': str(day + 1),
                        'start_hour': hour * 0.5,
                        'end_hour': 0,  # 0 hour of next day
                    }) for hour in range(2) for day in range(7)],
                })
        appointment_types |= self.create(appointment_types_work_hours)

        return appointment_types
