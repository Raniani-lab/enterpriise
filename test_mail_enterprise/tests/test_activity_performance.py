# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.test_mail.tests.test_performance import BaseMailPerformance
from odoo.tests.common import users, warmup
from odoo.tests import tagged
from odoo.tools import mute_logger


@tagged('mail_performance')
class TestActivityPerformance(BaseMailPerformance):

    @classmethod
    def setUpClass(cls):
        super(TestActivityPerformance, cls).setUpClass()
        cls.user_admin = cls.env.ref('base.user_admin')
        cls.user_admin.write({
            'country_id': cls.env.ref('base.be').id,
            'email': 'test.admin@test.example.com',
            'notification_type': 'inbox',
        })
        cls.user_employee.write({
            'country_id': cls.env.ref('base.be').id,
            'login': 'employee',
        })

        cls.customer = cls.env['res.partner'].with_context(cls._quick_create_ctx).create({
            'country_id': cls.env.ref('base.be').id,
            'email': '"Super Customer" <customer.test@example.com>',
            'mobile': '0456123456',
            'name': 'Super Customer',
        })
        cls.test_record = cls.env['mail.test.sms.bl.activity'].with_context(cls._quick_create_ctx).create({
            'name': 'Test Record',
            'customer_id': cls.customer.id,
            'email_from': cls.customer.email,
            'phone_nbr': '0456999999',
        })

        cls.phonecall_activity = cls.env.ref('mail.mail_activity_data_call')
        cls.phonecall_activity.write({
            'default_user_id': cls.user_admin.id,
        })

        cls.env['mail.activity.type'].search([
            ('category', '=', 'phonecall'),
            ('id', '!=', cls.phonecall_activity.id),
        ]).unlink()

    def setUp(self):
        super(TestActivityPerformance, self).setUp()

        self._init_mail_gateway()

    @users('__system__', 'employee')
    @warmup
    def test_activity_mixin_crud(self):
        """ Simply check CRUD operations on records having advanced mixing
        enabled. No computed fields are involved. """
        ActivityModel = self.env['mail.test.sms.bl.activity']

        with self.assertQueryCount(__system__=10, employee=10):
            record = ActivityModel.create({
                'name': 'Test',
            })
            record.flush()

        with self.assertQueryCount(__system__=1, employee=1):
            record.write({'name': 'New Name'})
            record.flush()

    @users('employee')
    @warmup
    def test_activity_mixin_schedule_call(self):
        """ Simply check CRUD operations on records having advanced mixing
        enabled. No computed fields are involved. """
        record = self.env['mail.test.sms.bl.activity'].browse(self.test_record.ids)

        with self.assertQueryCount(employee=34):
            activity = record.activity_schedule('mail.mail_activity_data_call', summary='Call Activity')
            activity.flush()

        # check business information (to benefits from this test)
        self.assertEqual(record.activity_ids, activity)
        self.assertEqual(activity.user_id, self.user_admin)
