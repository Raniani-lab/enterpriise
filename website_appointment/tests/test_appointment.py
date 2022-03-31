# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.appointment.tests.common import AppointmentCommon
from odoo.addons.website.tests.test_website_visitor import MockVisitor
from odoo.exceptions import ValidationError
from odoo.tests import users, tagged


@tagged('appointment')
class WAppointmentTest(AppointmentCommon, MockVisitor):

    def test_apt_type_create_from_website(self):
        """ Test that when creating an appointment type from the website, we use
        the visitor's timezone as fallback for the user's timezone """
        test_user = self.apt_manager
        test_user.write({'tz': False})

        visitor = self.env['website.visitor'].create({
            "name": 'Test Visitor',
            "partner_id": test_user.partner_id.id,
            "timezone": False,
        })

        AppointmentType = self.env['calendar.appointment.type']
        with self.mock_visitor_from_request(force_visitor=visitor):
            # Test appointment timezone when user and visitor both don't have timezone
            AppointmentType.with_user(test_user).create_and_get_website_url(**{'name': 'Appointment UTC Timezone'})
            self.assertEqual(
                AppointmentType.search([
                    ('name', '=', 'Appointment UTC Timezone')
                ]).appointment_tz, 'UTC'
            )

            # Test appointment timezone when user doesn't have timezone and visitor have timezone
            visitor.timezone = 'Europe/Brussels'
            AppointmentType.with_user(test_user).create_and_get_website_url(**{'name': 'Appointment Visitor Timezone'})
            self.assertEqual(
                AppointmentType.search([
                    ('name', '=', 'Appointment Visitor Timezone')
                ]).appointment_tz, visitor.timezone
            )

            # Test appointment timezone when user has timezone
            test_user.tz = 'Asia/Calcutta'
            AppointmentType.with_user(test_user).create_and_get_website_url(**{'name': 'Appointment User Timezone'})
            self.assertEqual(
                AppointmentType.search([
                    ('name', '=', 'Appointment User Timezone')
                ]).appointment_tz, test_user.tz
            )

    @users('admin')
    def test_apt_type_is_published(self):
        for category, default in [
                ('custom', True),
                ('website', False),
                ('work_hours', True)
            ]:
            appointment_type = self.env['calendar.appointment.type'].create({
                'name': 'Custom Appointment',
                'category': category,
            })
            self.assertEqual(appointment_type.is_published, default)

            if category in ['custom', 'website']:
                appointment_copied = appointment_type.copy()
                self.assertFalse(appointment_copied.is_published, "When we copy an appointment type, the new one should not be published")

                appointment_type.write({'is_published': False})
                appointment_copied = appointment_type.copy()
                self.assertFalse(appointment_copied.is_published)
            else:
                with self.assertRaises(ValidationError):
                    # A maximum of 1 work_hours per employee is allowed
                    appointment_type.copy()

    @users('admin')
    def test_apt_type_is_published_update(self):
        appointment = self.env['calendar.appointment.type'].create({
            'name': 'Website Appointment',
            'category': 'website',
        })
        self.assertFalse(appointment.is_published, "A website appointment type should not be published at creation")

        appointment.write({'category': 'custom'})
        self.assertTrue(appointment.is_published, "Modifying an appointment type category to custom auto-published it")

        appointment.write({'category': 'website'})
        self.assertFalse(appointment.is_published, "Modifying an appointment type category to website unpublished it")

        appointment.write({'category': 'work_hours'})
        self.assertTrue(appointment.is_published, "Modifying an appointment type category to work_hours auto-published it")
