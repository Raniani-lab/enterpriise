# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licens

from odoo import http
from odoo.addons.planning.controllers.main import ShiftController
from odoo.http import request


class ShiftControllerProject(ShiftController):

    def _planning_get(self, planning_token, employee_token, message=False):
        result = super()._planning_get(planning_token, employee_token, message)
        if not result:
            # one of the token does not match an employee/planning
            return
        employee_fullcalendar_data = result['employee_slots_fullcalendar_data']
        new_employee_fullcalendar_data = []
        for slot_data in employee_fullcalendar_data:
            slot_sudo = request.env['planning.slot'].sudo().browse(slot_data['slot_id'])
            slot_data['project'] = slot_sudo.project_id.name
            slot_data['task'] = slot_sudo.task_id.name
            new_employee_fullcalendar_data.append(slot_data)
        result['employee_slots_fullcalendar_data'] = new_employee_fullcalendar_data
        open_slots = result['open_slots_ids']
        result['has_project'] = any([s.project_id.id for s in open_slots])
        result['has_task'] = any([s.task_id.id for s in open_slots])
        return result
