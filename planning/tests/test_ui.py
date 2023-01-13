# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo.tests import HttpCase, new_test_user, tagged

@tagged('-at_install', 'post_install')
class TestUi(HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.employee_thibault = cls.env['hr.employee'].create({
            'name': 'Thibault',
            'work_email': 'thibault@a.be',
            'tz': 'UTC',
            'employee_type': 'freelance',
            'flexible_hours': True,
        })

    def test_01_ui(self):
        self.start_tour("/", 'planning_test_tour', login='admin')

    def test_shift_switch_ui(self):
        bert_user = new_test_user(self.env,
                                  login='bert_user',
                                  groups='planning.group_planning_user',
                                  name='Bert User',
                                  email='user@example.com')
        joseph_user = new_test_user(self.env,
                                    login='joseph_user',
                                    groups='planning.group_planning_user',
                                    name='Joseph User',
                                    email='juser@example.com')
        employee_bert, employee_joseph = self.env['hr.employee'].create([
            {
                'name': 'bert',
                'work_email': 'bert@a.be',
                'tz': 'UTC',
                'employee_type': 'freelance',
                'create_date': '2015-01-01 00:00:00',
                'user_id': bert_user.id,
            },
            {
                'name': 'joseph',
                'work_email': 'joseph@a.be',
                'tz': 'UTC',
                'employee_type': 'freelance',
                'create_date': '2015-01-01 00:00:00',
                'user_id': joseph_user.id,
            }
        ])
        test_slot = self.env['planning.slot'].create({
            'start_datetime': datetime.now() + relativedelta(days=1),
            'end_datetime': datetime.now() + relativedelta(days=1, hours=1),
            'state': 'published',
            'resource_id': employee_bert.resource_id.id,
        })
        self.assertEqual(test_slot.request_to_switch, False, 'Before requesting to switch, the request to switch should be False')
        self.start_tour("/", 'planning_shift_switching_backend', login='bert_user')
        self.assertEqual(test_slot.request_to_switch, True, 'Before requesting to switch, the request to switch should be False')
        self.start_tour("/", 'planning_assigning_unwanted_shift_backend', login='admin')
        self.assertEqual(test_slot.request_to_switch, False, 'After the assign action, the request to switch should be False')
        self.assertEqual(test_slot.resource_id, employee_joseph.resource_id, 'The shift should now be assigned to Joseph')
