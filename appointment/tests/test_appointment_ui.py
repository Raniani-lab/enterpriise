# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from datetime import datetime, timedelta
from freezegun import freeze_time

from odoo.addons.appointment.tests.common import AppointmentCommon
from odoo.addons.mail.tests.common import mail_new_test_user
from odoo.tests import common, tagged, users


@tagged('appointment_ui', '-at_install', 'post_install')
class AppointmentUICommon(AppointmentCommon, common.HttpCase):

    @classmethod
    def setUpClass(cls):
        super(AppointmentUICommon, cls).setUpClass()

        cls.std_user = mail_new_test_user(
            cls.env,
            company_id=cls.company_admin.id,
            email='std_user@test.example.com',
            groups='base.group_user',
            name='Solène StandardUser',
            notification_type='email',
            login='std_user',
            tz='Europe/Brussels'  # UTC + 1 (at least in February)
        )


@tagged('appointment_ui', '-at_install', 'post_install')
class AppointmentUITest(AppointmentUICommon):

    @users('apt_manager')
    def test_route_apt_type_create_custom(self):
        self.authenticate(self.env.user.login, self.env.user.login)

        with freeze_time(self.reference_now):
            unique_slots = [{
                'start': (datetime.now() + timedelta(hours=1)).replace(microsecond=0).isoformat(' '),
                'end': (datetime.now() + timedelta(hours=2)).replace(microsecond=0).isoformat(' '),
                'allday': False,
            }, {
                'start': (datetime.now() + timedelta(days=2)).replace(microsecond=0).isoformat(' '),
                'end': (datetime.now() + timedelta(days=3)).replace(microsecond=0).isoformat(' '),
                'allday': True,
            }]
            request = self.url_open(
                "/appointment/appointment_type/create_custom",
                data=json.dumps({
                    'params': {
                        'slots': unique_slots,
                    }
                }),
                headers={"Content-Type": "application/json"},
            ).json()
        result = request.get('result', {})
        self.assertTrue(result.get('appointment_type_id'), 'The request returns the id of the custom appointment type')
        appointment_type = self.env['appointment.type'].browse(result['appointment_type_id'])
        self.assertEqual(appointment_type.category, 'custom')
        self.assertEqual(appointment_type.name, "%s - Let's meet" % self.env.user.name)
        self.assertEqual(len(appointment_type.slot_ids), 2, "Two slots have been created")

        with freeze_time(self.reference_now):
            for slot in appointment_type.slot_ids:
                self.assertEqual(slot.slot_type, 'unique', 'All slots should be unique')
                if slot.allday:
                    self.assertEqual(slot.start_datetime, datetime.now() + timedelta(days=2))
                    self.assertEqual(slot.end_datetime, datetime.now() + timedelta(days=3))
                else:
                    self.assertEqual(slot.start_datetime, datetime.now() + timedelta(hours=1))
                    self.assertEqual(slot.end_datetime, datetime.now() + timedelta(hours=2))

    def test_share_appointment_type(self):
        self._create_invite_test_data()
        self.authenticate(None, None)
        res = self.url_open(self.invite_apt_type_bxls_2days.book_url)
        self.assertEqual(res.status_code, 200, "Response should = OK")

    def test_share_appointment_type_multi(self):
        self._create_invite_test_data()
        self.authenticate(None, None)
        res = self.url_open(self.invite_all_apts.book_url)
        self.assertEqual(res.status_code, 200, "Response should = OK")


@tagged('appointment_ui', '-at_install', 'post_install')
class CalendarTest(AppointmentUICommon):

    def test_meeting_accept_authenticated(self):
        event = self.env["calendar.event"].create(
            {"name": "Doom's day",
             "start": datetime(2019, 10, 25, 8, 0),
             "stop": datetime(2019, 10, 27, 18, 0),
             "partner_ids": [(4, self.std_user.partner_id.id)],
            }
        )
        token = event.attendee_ids[0].access_token
        url = "/calendar/meeting/accept?token=%s&id=%d" % (token, event.id)
        self.authenticate(self.std_user.login, self.std_user.login)
        res = self.url_open(url)

        self.assertEqual(res.status_code, 200, "Response should = OK")
        event.attendee_ids[0].invalidate_recordset()
        self.assertEqual(event.attendee_ids[0].state, "accepted", "Attendee should have accepted")

    def test_meeting_accept_unauthenticated(self):
        event = self.env["calendar.event"].create(
            {"name": "Doom's day",
             "start": datetime(2019, 10, 25, 8, 0),
             "stop": datetime(2019, 10, 27, 18, 0),
             "partner_ids": [(4, self.std_user.partner_id.id)],
            }
        )
        token = event.attendee_ids[0].access_token
        url = "/calendar/meeting/accept?token=%s&id=%d" % (token, event.id)
        res = self.url_open(url)

        self.assertEqual(res.status_code, 200, "Response should = OK")
        event.attendee_ids[0].invalidate_recordset()
        self.assertEqual(event.attendee_ids[0].state, "accepted", "Attendee should have accepted")
