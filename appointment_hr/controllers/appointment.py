# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo.addons.appointment.controllers.appointment import Appointment
from odoo.http import request

class AppointmentHr(Appointment):

    # ------------------------------------------------------------
    # APPOINTMENT TYPE PAGE VIEW
    # ------------------------------------------------------------

    def _get_filtered_staff_user_ids(self, appointment_type, filter_staff_user_ids=None, **kwargs):
        """ This method returns the ids of suggested users, ensuring retrocompatibility with previous routes.
            These may be cleaned in the future. If several parameters exist, the priority is given to the newest
            route format filter first."""

        res = super(AppointmentHr, self)._get_filtered_staff_user_ids(appointment_type, filter_staff_user_ids, **kwargs)
        if res:
            return res

        # Ensure old link ?filter_employee_ids= retrocompatibility. This parameter is deprecated since task-2499566.
        json_filter_employee_ids = kwargs.get('filter_employee_ids')
        filter_employee_ids = json.loads(json_filter_employee_ids) if json_filter_employee_ids else []
        if filter_employee_ids:
            employees = request.env['hr.employee'].sudo().browse(filter_employee_ids)
            valid_employees = employees.filtered(lambda emp: emp.exists() and emp.user_id in appointment_type.staff_user_ids)
            if valid_employees:
                return valid_employees.user_id.ids

        # Ensure old link ?employee_id= retrocompatibility. This parameter is deprecated since task-2190526.
        employee_id = kwargs.get('employee_id')
        if employee_id:
            employee = request.env['hr.employee'].sudo().browse(int(employee_id))
            if employee.exists() and employee.user_id in appointment_type.staff_user_ids:
                return employee.user_id.ids

        return []
