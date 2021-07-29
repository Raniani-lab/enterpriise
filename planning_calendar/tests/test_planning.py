# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from unittest.mock import patch

from odoo.tests.common import tagged, new_test_user
from odoo.addons.planning.tests.common import TestCommonPlanning


def _mock_model_blacklist(self):
    return ['planning.slot']

@tagged('post_install', '-at_install')
class TestPlanning(TestCommonPlanning):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.setUpEmployees()

        cls.user_joseph = new_test_user(cls.env, login='joseph')
        cls.user_bert = new_test_user(cls.env, login='bert')
        cls.user_janice = new_test_user(cls.env, login='janice')

        cls.employee_joseph.user_id = cls.user_joseph.id
        cls.employee_bert.user_id = cls.user_bert.id
        cls.employee_janice.user_id = cls.user_janice.id

    def test_event_create_slot(self):
        events_joseph = self.env['calendar.event'].search([('user_id', '=', self.user_joseph.id)])
        self.assertFalse(events_joseph, 'No event for Joseph')
        slots_joseph = self.env['planning.slot'].search([('resource_id', '=', self.resource_joseph.id)])
        self.assertFalse(slots_joseph, 'No slot for Joseph')

        event = self.env['calendar.event'].with_user(self.user_joseph).create({
            'name': 'coucou',
            'start': datetime(2021, 1, 1, 8, 0),
            'stop': datetime(2021, 1, 1, 10, 0),
        })
        event.action_create_slots()
        slot = self.env['planning.slot'].search([('resource_id', '=', self.resource_joseph.id)])

        self.assertEqual(slot.state, 'published', 'The slot should be published')

        event.unlink()
        self.assertFalse(slot.exists(), "The slot should be deleted")

    def test_event_slot_show_as(self):
        events_joseph = self.env['calendar.event'].search([('user_id', '=', self.user_joseph.id)])
        self.assertFalse(events_joseph, 'No event for Joseph')
        slots_joseph = self.env['planning.slot'].search([('resource_id', '=', self.resource_joseph.id)])
        self.assertFalse(slots_joseph, 'No slot for Joseph')

        event = self.env['calendar.event'].with_user(self.user_joseph).create({
            'name': 'coucou',
            'start': datetime(2021, 1, 1, 8, 0),
            'stop': datetime(2021, 1, 1, 10, 0),
            'show_as': 'free',
        })
        event.action_create_slots()

        slot = self.env['planning.slot'].search([('resource_id', '=', self.resource_joseph.id)])
        self.assertFalse(slot, 'No slot should be created for "available" event')

    def test_event_change(self):
        event = self.env['calendar.event'].with_user(self.user_joseph).create({
            'name': 'coucou',
            'start': datetime(2021, 1, 1, 8, 0),
            'stop': datetime(2021, 1, 1, 10, 0),
        })
        event.action_create_slots()

        slot = self.env['planning.slot'].search([('resource_id', '=', self.resource_joseph.id)])
        self.assertEqual(slot.calendar_event_id, event)

        self.assertEqual(event.start, slot.start_datetime)
        self.assertEqual(event.stop, slot.end_datetime)

        event.show_as = 'free'
        self.assertFalse(slot.exists())

    def test_model_event_blacklist(self):
        with patch('odoo.addons.planning_calendar.models.planning_slot.PlanningSlot._get_calendar_model_blacklist', new=_mock_model_blacklist):
            event = self.env['calendar.event'].with_user(self.user_joseph).create({
                'name': 'coucou',
                'start': datetime(2021, 1, 1, 8, 0),
                'stop': datetime(2021, 1, 1, 10, 0),
                'res_model_id': self.env.ref('planning.model_planning_slot').id,
            })
            event.action_create_slots()
            slot = self.env['planning.slot'].search([('resource_id', '=', self.resource_joseph.id)])
            self.assertFalse(slot, 'No slot should be created for blacklisted model')
