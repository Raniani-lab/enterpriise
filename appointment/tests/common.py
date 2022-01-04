# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from contextlib import contextmanager
from datetime import datetime
from unittest.mock import patch

from odoo.addons.appointment.models.res_partner import Partner
from odoo.addons.calendar.models.calendar_event import Meeting
from odoo.addons.resource.models.resource import ResourceCalendar
from odoo.addons.mail.tests.common import mail_new_test_user, MailCommon


class AppointmentCommon(MailCommon):

    @classmethod
    def setUpClass(cls):
        super(AppointmentCommon, cls).setUpClass()

        # give default values for all email aliases and domain
        cls._init_mail_gateway()
        # ensure admin configuration
        cls.admin_user = cls.env.ref('base.user_admin')
        cls.admin_user.write({
            'country_id': cls.env.ref('base.be').id,
            'login': 'admin',
            'notification_type': 'inbox',
        })
        cls.company_admin = cls.admin_user.company_id
        # set country in order to format Belgian numbers
        cls.company_admin.write({
            'country_id': cls.env.ref('base.be').id,
        })

        # reference dates to have reproducible tests (sunday evening, allowing full week)
        cls.reference_now = datetime(2022, 2, 13, 20, 0, 0)
        cls.reference_monday = datetime(2022, 2, 14, 8, 0, 0)

        cls.apt_manager = mail_new_test_user(
            cls.env,
            company_id=cls.company_admin.id,
            email='apt_manager@test.example.com',
            groups='base.group_user,appointment.group_calendar_manager',
            name='Appointment Manager',
            notification_type='email',
            login='apt_manager',
            tz='Europe/Brussels'
        )
        cls.staff_user_bxls = mail_new_test_user(
            cls.env,
            company_id=cls.company_admin.id,
            email='brussels@test.example.com',
            groups='base.group_user',
            name='Employee Brussels',
            notification_type='email',
            login='staff_user_bxls',
            tz='Europe/Brussels'
        )
        cls.staff_user_aust = mail_new_test_user(
            cls.env,
            company_id=cls.company_admin.id,
            email='australia@test.example.com',
            groups='base.group_user',
            name='Employee Australian',
            notification_type='email',
            login='staff_user_aust',
            tz='Australia/West'
        )

        # Default (test) appointment type
        cls.apt_type_bxls_2days = cls.env['calendar.appointment.type'].create({
            'appointment_tz': 'Europe/Brussels',
            'appointment_duration': 1,
            'assign_method': 'random',
            'category': 'website',
            'location': 'Bxls Office',
            'name': 'Bxls Appt Type',
            'max_schedule_days': 15,
            'min_cancellation_hours': 1,
            'min_schedule_hours': 1,
            'slot_ids': [
                (0, False, {'weekday': weekday,
                            'start_hour': hour,
                            'end_hour': hour + 1,
                           })
                for weekday in ['1', '2']
                for hour in range(8, 14)
            ],
            'staff_user_ids': [(4, cls.staff_user_bxls.id)],
        })

    def _flush_tracking(self):
        """ Force the creation of tracking values notably, and ensure tests are
        reproducible. """
        self.env['base'].flush()
        self.cr.flush()

    def assertSlots(self, slots, exp_months, slots_data):
        """ Check slots content. Method to be improved soon, currently doing
        only basic checks. """
        self.assertEqual(len(slots), len(exp_months), 'Slots: wrong number of covered months')
        self.assertEqual(slots[0]['weeks'][0][0]['day'], slots_data['startdate'], 'Slots: wrong starting date')
        self.assertEqual(slots[-1]['weeks'][-1][-1]['day'], slots_data['enddate'], 'Slots: wrong ending date')
        for month, expected_month in zip(slots, exp_months):
            self.assertEqual(month['month'], expected_month['name_formated'])
            self.assertEqual(len(month['weeks']), expected_month['weeks_count'])

    @contextmanager
    def mockAppointmentCalls(self):
        _original_search = Meeting.search
        _original_search_count = Meeting.search_count
        _original_calendar_verify_availability = Partner.calendar_verify_availability
        _original_work_intervals_batch = ResourceCalendar._work_intervals_batch
        with patch.object(Meeting, 'search',
                          autospec=True, side_effect=_original_search) as mock_ce_search, \
             patch.object(Meeting, 'search_count',
                          autospec=True, side_effect=_original_search_count) as mock_ce_sc, \
             patch.object(Partner, 'calendar_verify_availability',
                          autospec=True, side_effect=_original_calendar_verify_availability) as mock_partner_cal, \
             patch.object(ResourceCalendar, '_work_intervals_batch',
                          autospec=True, side_effect=_original_work_intervals_batch) as mock_cal_wit:
            self._mock_calevent_search = mock_ce_search
            self._mock_calevent_search_count = mock_ce_sc
            self._mock_partner_calendar_check = mock_partner_cal
            self._mock_cal_work_intervals = mock_cal_wit
            yield
