# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import pytz

from datetime import date, datetime, timedelta
from freezegun import freeze_time

from odoo.addons.appointment.tests.common import AppointmentCommon
from odoo.exceptions import ValidationError
from odoo.tests import tagged, users


@tagged('appointment_slots')
class AppointmentTest(AppointmentCommon):

    @users('apt_manager')
    def test_appointment_type_create(self):
        # Custom: current user set as default, otherwise accepts only 1 user
        apt_type = self.env['calendar.appointment.type'].create({
            'category': 'custom',
            'name': 'Custom without user',
        })
        self.assertEqual(apt_type.staff_user_ids, self.apt_manager)

        apt_type = self.env['calendar.appointment.type'].create({
            'category': 'custom',
            'staff_user_ids': [(4, self.staff_users[0].id)],
            'name': 'Custom with user',
        })
        self.assertEqual(apt_type.staff_user_ids, self.staff_users[0])

        with self.assertRaises(ValidationError):
            self.env['calendar.appointment.type'].create({
                'category': 'custom',
                'staff_user_ids': self.staff_users.ids,
                'name': 'Custom with users',
            })

    @users('apt_manager')
    def test_generate_slots_recurring(self):
        """ Generates recurring slots, check begin and end slot boundaries. """
        apt_type = self.apt_type_bxls_2days.with_user(self.env.user)

        with freeze_time(self.reference_now):
            slots = apt_type._get_appointment_slots('Europe/Brussels')

        global_slots_startdate = self.reference_now_monthweekstart
        global_slots_enddate = date(2022, 3, 5)  # last day of last week of February
        self.assertSlots(
            slots,
            [{'name_formated': 'February 2022',
              'month_date': datetime(2022, 2, 1),
              'weeks_count': 5,  # 31/01 -> 28/02 (06/03)
             }
            ],
            {'enddate': global_slots_enddate,
             'startdate': global_slots_startdate,
             'slots_start_hours': [8, 9, 10, 11, 12, 13],  # based on appointment type start hours of slots, no work hours / no meetings / no leaves
             'slots_startdate': self.reference_monday.date(),  # first Monday after reference_now
             'slots_weekdays_nowork': range(2, 7)  # working hours only on Monday/Tuesday (0, 1)
            }
        )

    @users('apt_manager')
    def test_generate_slots_recurring_UTC(self):
        """ Generates recurring slots, check begin and end slot boundaries. Force
        UTC results event if everything is Europe/Brussels based. """
        apt_type = self.apt_type_bxls_2days.with_user(self.env.user)

        with freeze_time(self.reference_now):
            slots = apt_type._get_appointment_slots('UTC')

        global_slots_startdate = self.reference_now_monthweekstart
        global_slots_enddate = date(2022, 3, 5)  # last day of last week of February
        self.assertSlots(
            slots,
            [{'name_formated': 'February 2022',
              'month_date': datetime(2022, 2, 1),
              'weeks_count': 5,  # 31/01 -> 28/02 (06/03)
             }
            ],
            {'enddate': global_slots_enddate,
             'startdate': global_slots_startdate,
             'slots_start_hours': [7, 8, 9, 10, 11, 12],  # based on appointment type start hours of slots, no work hours / no meetings / no leaves
             'slots_startdate': self.reference_monday.date(),  # first Monday after reference_now
             'slots_weekdays_nowork': range(2, 7)  # working hours only on Monday/Tuesday (0, 1)
            }
        )

    @users('admin')
    def test_generate_slots_recurring_westrict(self):
        """ Generates recurring slots, check user restrictions """
        apt_type = self.apt_type_bxls_2days.with_user(self.env.user)
        # add second staff user and split days based on the two people
        apt_type.write({'staff_user_ids': [(4, self.staff_user_aust.id)]})
        apt_type.slot_ids.filtered(lambda slot: slot.weekday == '1').write({
            'restrict_to_user_ids': [(4, self.staff_user_bxls.id)],
        })
        apt_type.slot_ids.filtered(lambda slot: slot.weekday != '1').write({
            'restrict_to_user_ids': [(4, self.staff_user_aust.id)],
        })

        with freeze_time(self.reference_now):
            slots = apt_type._get_appointment_slots('Europe/Brussels')

        global_slots_startdate = self.reference_now_monthweekstart
        global_slots_enddate = date(2022, 3, 5)  # last day of last week of February
        self.assertSlots(
            slots,
            [{'name_formated': 'February 2022',
              'month_date': datetime(2022, 2, 1),
              'weeks_count': 5,  # 31/01 -> 28/02 (06/03)
             }
            ],
            {'enddate': global_slots_enddate,
             'startdate': global_slots_startdate,
             'slots_start_hours': [8, 9, 10, 11, 12, 13],  # based on appointment type start hours of slots, no work hours / no meetings / no leaves
             'slots_startdate': self.reference_monday.date(),  # first Monday after reference_now
             'slots_weekdays_nowork': range(2, 7)  # working hours only on Monday/Tuesday (0, 1)
            }
        )

        # check staff_user_id
        monday_slots = [
            slot
            for month in slots for week in month['weeks'] for day in week
            for slot in day['slots']
            if day['day'].weekday() == 0
        ]
        tuesday_slots = [
            slot
            for month in slots for week in month['weeks'] for day in week
            for slot in day['slots']
            if day['day'].weekday() == 1
        ]
        self.assertEqual(len(monday_slots), 18, 'Slots: 3 mondays of 6 slots')
        self.assertTrue(all(slot['staff_user_id'] == self.staff_user_bxls.id for slot in monday_slots))
        self.assertEqual(len(tuesday_slots), 12, 'Slots: 2 tuesdays of 6 slots (3rd tuesday is out of range')
        self.assertTrue(all(slot['staff_user_id'] == self.staff_user_aust.id for slot in tuesday_slots))

    @users('apt_manager')
    def test_generate_slots_recurring_wmeetings(self):
        """ Generates recurring slots, check begin and end slot boundaries
        with leaves involved. """
        apt_type = self.apt_type_bxls_2days.with_user(self.env.user)

        # create meetings
        _meetings = self._create_meetings(
            self.staff_user_bxls,
            [(self.reference_monday + timedelta(days=1),  # 3 hours first Tuesday
              self.reference_monday + timedelta(days=1, hours=3),
              False
             ),
             (self.reference_monday + timedelta(days=7), # next Monday: one full day
              self.reference_monday + timedelta(days=7, hours=1),
              True,
             ),
             (self.reference_monday + timedelta(days=8, hours=2), # 1 hour next Tuesday (9 UTC)
              self.reference_monday + timedelta(days=8, hours=3),
              False,
             ),
             (self.reference_monday + timedelta(days=8, hours=3), # 1 hour next Tuesday (10 UTC, declined)
              self.reference_monday + timedelta(days=8, hours=4),
              False,
             ),
             (self.reference_monday + timedelta(days=8, hours=5), # 2 hours next Tuesday (12 UTC)
              self.reference_monday + timedelta(days=8, hours=7),
              False,
             ),
            ]
        )
        attendee = _meetings[-2].attendee_ids.filtered(lambda att: att.partner_id == self.staff_user_bxls.partner_id)
        attendee.do_decline()

        with freeze_time(self.reference_now):
            slots = apt_type._get_appointment_slots('Europe/Brussels')

        global_slots_startdate = self.reference_now_monthweekstart
        global_slots_enddate = date(2022, 3, 5)  # last day of last week of February
        self.assertSlots(
            slots,
            [{'name_formated': 'February 2022',
              'month_date': datetime(2022, 2, 1),
              'weeks_count': 5,  # 31/01 -> 28/02 (06/03)
             }
            ],
            {'enddate': global_slots_enddate,
             'startdate': global_slots_startdate,
             'slots_day_specific': {
                (self.reference_monday + timedelta(days=1)).date(): [
                    {'end': 12, 'start': 11},
                    {'end': 13, 'start': 12},
                    {'end': 14, 'start': 13},
                ],  # meetings on 7-10 UTC
                (self.reference_monday + timedelta(days=7)).date(): [],  # on meeting "allday"
                (self.reference_monday + timedelta(days=8)).date(): [
                    {'end': 9, 'start': 8},
                    {'end': 10, 'start': 9},
                    {'end': 12, 'start': 11},
                    {'end': 13, 'start': 12},
                ],  # meetings 9-10 and 12-14
             },
             'slots_start_hours': [8, 9, 10, 11, 12, 13],  # based on appointment type start hours of slots, no work hours / no meetings / no leaves
             'slots_startdate': self.reference_monday.date(),  # first Monday after reference_now
             'slots_weekdays_nowork': range(2, 7)  # working hours only on Monday/Tuesday (0, 1)
            }
        )

    @users('apt_manager')
    def test_generate_slots_unique(self):
        """ Check unique slots (note: custom appointment type does not check working
        hours). """
        unique_slots = [{
            'start_datetime': self.reference_monday.replace(microsecond=0),
            'end_datetime': (self.reference_monday + timedelta(hours=1)).replace(microsecond=0),
            'allday': False,
        }, {
            'start_datetime': (self.reference_monday + timedelta(days=1)).replace(microsecond=0),
            'end_datetime': (self.reference_monday + timedelta(days=2)).replace(microsecond=0),
            'allday': True,
        }]
        apt_type = self.env['calendar.appointment.type'].create({
            'category': 'custom',
            'name': 'Custom with unique slots',
            'slot_ids': [(5, 0)] + [
                (0, 0, {'allday': slot['allday'],
                        'end_datetime': slot['end_datetime'],
                        'slot_type': 'unique',
                        'start_datetime': slot['start_datetime'],
                       }
                ) for slot in unique_slots
            ],
        })
        self.assertEqual(apt_type.category, 'custom', "It should be a custom appointment type")
        self.assertEqual(apt_type.staff_user_ids, self.apt_manager)
        self.assertEqual(len(apt_type.slot_ids), 2, "Two slots should have been assigned to the appointment type")

        with freeze_time(self.reference_now):
            slots = apt_type._get_appointment_slots('Europe/Brussels')

        global_slots_startdate = self.reference_now_monthweekstart
        global_slots_enddate = date(2022, 3, 5)  # last day of last week of February
        self.assertSlots(
            slots,
            [{'name_formated': 'February 2022',
              'month_date': datetime(2022, 2, 1),
              'weeks_count': 5,  # 31/01 -> 28/02 (06/03)
             }
            ],
            {'enddate': global_slots_enddate,
             'startdate': global_slots_startdate,
             'slots_day_specific': {
                self.reference_monday.date(): [{'end': 9, 'start': 8}],  # first unique 1 hour long
                (self.reference_monday + timedelta(days=1)).date(): [{'allday': True, 'end': False, 'start': 8}],  # second unique all day-based
             },
             'slots_start_hours': [],  # all slots in this tests are unique, other dates have no slots
             'slots_startdate': self.reference_monday.date(),  # first Monday after reference_now
             'slots_weekdays_nowork': range(2, 7)  # working hours only on Monday/Tuesday (0, 1)
            }
        )

    @users('apt_manager')
    def test_slots_for_today(self):
        test_reference_now = datetime(2022, 2, 14, 11, 0, 0)  # is a Monday
        appointment = self.env['calendar.appointment.type'].create({
            'appointment_tz': 'UTC',
            'min_schedule_hours': 1.0,
            'max_schedule_days': 8,
            'name': 'Test',
            'slot_ids': [(0, 0, {
                'weekday': str(test_reference_now.isoweekday()),
                'start_hour': 6,
                'end_hour': 18,
            })],
            'staff_user_ids': [self.staff_user_bxls.id],
        })
        first_day = (test_reference_now + timedelta(hours=appointment.min_schedule_hours)).astimezone(pytz.UTC)
        last_day = (test_reference_now + timedelta(days=appointment.max_schedule_days)).astimezone(pytz.UTC)
        with freeze_time(test_reference_now):
            slots = appointment._slots_generate(first_day, last_day, 'UTC')

        # self.assertEqual(len(slots), 18, '2 mondays of 12 slots but 6 would be before reference date')
        # for slot in slots:
            # self.assertTrue(
            #     test_reference_now.astimezone(pytz.UTC) < slot['UTC'][0].astimezone(pytz.UTC),
            #     "A slot shouldn't be generated before the first_day datetime")

    @users('staff_user_aust')
    def test_timezone_delta(self):
        """ Test timezone delta. Not sure what original test was really doing. """
        # As if the second user called the function
        apt_type = self.apt_type_bxls_2days.with_user(self.env.user).with_context(
            lang='en_US',
            tz=self.staff_user_aust.tz,
            uid=self.staff_user_aust.id,
        )

        # Do what the controller actually does, aka sudo
        with freeze_time(self.reference_now):
            slots = apt_type.sudo()._get_appointment_slots('Australia/West', staff_user=None)

        global_slots_startdate = self.reference_now_monthweekstart
        global_slots_enddate = date(2022, 4, 2)  # last day of last week of March
        self.assertSlots(
            slots,
            [{'name_formated': 'February 2022',
              'month_date': datetime(2022, 2, 1),
              'weeks_count': 5,  # 31/01 -> 28/02 (06/03)
             },
             {'name_formated': 'March 2022',
              'month_date': datetime(2022, 3, 1),
              'weeks_count': 5,  # 28/02 -> 28/03 (03/04)
             }
            ],
            {'enddate': global_slots_enddate,
             'startdate': global_slots_startdate,
             'slots_enddate': self.reference_now.date() + timedelta(days=15),  # maximum 2 weeks of slots
             'slots_start_hours': [15, 16, 17, 18, 19, 20],  # based on appointment type start hours of slots, no work hours / no meetings / no leaves, set in UTC+8
             'slots_startdate': self.reference_monday.date(),  # first Monday after reference_now
             'slots_weekdays_nowork': range(2, 7)  # working hours only on Monday/Tuesday (0, 1)
            }
        )
