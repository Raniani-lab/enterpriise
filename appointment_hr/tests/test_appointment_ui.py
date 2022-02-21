# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo.addons.appointment.tests.test_appointment_ui import AppointmentTest
from odoo.tests import tagged, users


@tagged('appointment_ui', '-at_install', 'post_install')
class AppointmentHrTest(AppointmentTest):

    @users('admin')
    def test_search_create_work_hours(self):
        self.authenticate('admin', 'admin')
        request = self.url_open(
            "/appointment/calendar_appointment_type/search_create_work_hours",
            data=json.dumps({}),
            headers={"Content-Type": "application/json"},
        ).json()
        result = request.get('result', False)
        self.assertTrue(result.get('id'), 'The request returns the id of the custom appointment type')
        appointment_type = self.env['calendar.appointment.type'].browse(result['id'])
        self.assertEqual(appointment_type.category, 'work_hours')
        self.assertEqual(len(appointment_type.slot_ids), 14, "Two slots have been created")
        self.assertTrue(all(slot.slot_type == 'recurring' for slot in appointment_type.slot_ids), "All slots are 'recurring'")
