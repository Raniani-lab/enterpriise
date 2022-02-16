# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo.addons.appointment.tests.test_appointment_ui import AppointmentUICommon
from odoo.tests import tagged, users


@tagged('appointment_ui', '-at_install', 'post_install')
class AppointmentHrUITest(AppointmentUICommon):

    @users('apt_manager')
    def test_route_apt_type_search_create_work_hours(self):
        self.authenticate(self.env.user.login, self.env.user.login)
        request = self.url_open(
            "/appointment/appointment_type/search_create_work_hours",
            data=json.dumps({}),
            headers={"Content-Type": "application/json"},
        ).json()
        result = request.get('result', {})
        self.assertTrue(result.get('id'), 'The request returns the id of the custom appointment type')
        appointment_type = self.env['appointment.type'].browse(result['id'])
        self.assertEqual(appointment_type.category, 'work_hours')
        self.assertEqual(len(appointment_type.slot_ids), 14, "14 slots have been created: (2 / days for 7 days)")
        self.assertTrue(all(slot.slot_type == 'recurring' for slot in appointment_type.slot_ids), "All slots are 'recurring'")
        self.assertTrue(appointment_type.work_hours_activated)
