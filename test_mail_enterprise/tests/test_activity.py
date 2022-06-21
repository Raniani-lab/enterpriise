# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import exceptions
from odoo.addons.test_mail_sms.tests.common import TestSMSCommon, TestSMSRecipients
from odoo.tests.common import users
from odoo.tests import tagged
from odoo.tools import mute_logger


@tagged('mail_activity')
class TestActivity(TestSMSCommon, TestSMSRecipients):

    @classmethod
    def setUpClass(cls):
        super(TestActivity, cls).setUpClass()

        cls.test_record_voip = cls.env['mail.test.activity.bl.sms.voip'].create({
            'name': 'Test Record',
            'customer_id': cls.partner_1.id,
            'email_from': cls.partner_1.email,
            'phone_nbr': '0456999999',
        })

        cls.phonecall_activity = cls.env.ref('mail.mail_activity_data_call')
        cls.phonecall_activity.write({
            'default_user_id': cls.env.user.id,
        })

        # clean db to ease tests
        cls.env['mail.activity.type'].search([
            ('category', '=', 'phonecall'),
            ('id', '!=', cls.phonecall_activity.id),
        ]).unlink()

    def test_activity_data(self):
        """ Ensure initial data for tests """
        self.assertTrue(self.phonecall_activity)
        self.assertEqual(self.phonecall_activity.category, 'phonecall')

    @users('employee')
    @mute_logger('odoo.addons.voip.models.voip_queue_mixin')
    def test_create_call_in_queue(self):
        record = self.env['mail.test.activity.bl.sms.voip'].browse(self.test_record_voip.ids)

        activity = record.create_call_in_queue()
        self.assertEqual(activity.activity_type_id, self.phonecall_activity)

        phonecall_activities = self.env['mail.activity'].sudo().search([
            ('activity_type_id', '=', self.phonecall_activity.id),
        ])
        phonecall_activities.write({'activity_type_id': False})
        self.phonecall_activity.unlink()

        with self.assertRaises(exceptions.UserError):
            activity = record.create_call_in_queue()
