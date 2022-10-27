# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import random
import time

from datetime import timedelta
from freezegun import freeze_time
from logging import getLogger

from odoo.addons.appointment.tests.common import AppointmentCommon
from odoo.addons.website.tests.test_performance import UtilPerf
from odoo.tests import tagged
from odoo.tests.common import warmup

_logger = getLogger(__name__)


class AppointmentPerformanceCase(AppointmentCommon):

    def setUp(self):
        super(AppointmentPerformanceCase, self).setUp()
        # patch registry to simulate a ready environment
        self.patch(self.env.registry, 'ready', True)
        self._flush_tracking()


@tagged('appointment_performance', 'post_install', '-at_install')
class AppointmentUIPerformanceCase(AppointmentPerformanceCase, UtilPerf):

    @classmethod
    def setUpClass(cls):
        super(AppointmentUIPerformanceCase, cls).setUpClass()
        # if website_livechat is installed, disable it
        if 'website' in cls.env and 'channel_id' in cls.env['website']:
            cls.env['website'].search([]).channel_id = False


@tagged('appointment_performance', 'post_install', '-at_install')
class OnlineAppointmentPerformance(AppointmentUIPerformanceCase):

    def setUp(self):
        super(OnlineAppointmentPerformance, self).setUp()
        # Setup already some meetings for the staff user of appointment type
        self._create_meetings(
            self.staff_user_bxls,
            [(self.reference_monday + timedelta(days=1),  # 3 hours first Tuesday
              self.reference_monday + timedelta(days=1, hours=3),
              False
              ),
             (self.reference_monday + timedelta(days=7),  # next Monday: one full day
              self.reference_monday + timedelta(days=7, hours=1),
              True,
              ),
             ])

    @warmup
    def test_appointment_invitation_page_anonymous(self):
        """ Anonymous access of invitation page """
        random.seed(1871)  # fix shuffle in _slots_available
        invitation = self.env['appointment.invite'].create({
            'short_code': 'spock',
            'appointment_type_ids': self.apt_type_bxls_2days.ids,
        })

        self.authenticate(None, None)
        t0 = time.time()
        with freeze_time(self.reference_now):
            with self.assertQueryCount(default=29):  # apt 29
                self._test_url_open(invitation.redirect_url)
        t1 = time.time()

        _logger.info('Browsed %s, time %.3f', invitation.redirect_url, t1 - t0)

    @warmup
    def test_appointment_type_page_website_authenticated(self):
        """ Authenticated access of Appointment type page """
        random.seed(1871)  # fix shuffle in _slots_available

        self.authenticate('staff_user_aust', 'staff_user_aust')
        t0 = time.time()
        with freeze_time(self.reference_now):
            with self.assertQueryCount(default=36):  # apt 27
                self._test_url_open('/appointment/%i' % self.apt_type_bxls_2days.id)
        t1 = time.time()

        _logger.info('Browsed /appointment/%i, time %.3f', self.apt_type_bxls_2days.id, t1 - t0)
