# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.test_mail.tests.test_performance import BaseMailPerformance
from odoo.tests.common import users, warmup
from odoo.tests import tagged


@tagged('mail_performance')
class TestActivityPerformance(BaseMailPerformance):

    @classmethod
    def setUpClass(cls):
        super(TestActivityPerformance, cls).setUpClass()

        cls.customer = cls.env['res.partner'].with_context(cls._test_context).create({
            'country_id': cls.env.ref('base.be').id,
            'email': '"Super Customer" <customer.test@example.com>',
            'mobile': '0456123456',
            'name': 'Super Customer',
        })
        cls.test_record = cls.env['mail.test.sms.bl.activity'].with_context(cls._test_context).create({
            'name': 'Test Record',
            'customer_id': cls.customer.id,
            'email_from': cls.customer.email,
            'phone_nbr': '0456999999',
        })
        cls.test_record_voip = cls.env['mail.test.activity.bl.sms.voip'].with_context(cls._test_context).create({
            'name': 'Test Record',
            'customer_id': cls.customer.id,
            'email_from': cls.customer.email,
            'phone_nbr': '0456999999',
        })

        # documents records for activities
        cls.documents_test_folder = cls.env['documents.folder'].create({
            'name': 'Test Folder',
        })
        cls.documents_test_facet = cls.env['documents.facet'].create({
            'folder_id': cls.documents_test_folder.id,
            'name': 'Test Facet',
        })
        cls.documents_test_tags = cls.env['documents.tag'].create([
            {'facet_id': cls.documents_test_facet.id,
             'folder_id': cls.documents_test_folder.id,
             'name': 'Test Tag %d' % index,
            } for index in range(2)
        ])
        cls.phonecall_activity = cls.env.ref('mail.mail_activity_data_call')
        cls.phonecall_activity.write({
            'default_user_id': cls.user_admin.id,
        })
        cls.upload_activity = cls.env.ref('mail.mail_activity_data_upload_document')
        cls.upload_activity.write({
            'default_user_id': cls.user_admin.id,
            'folder_id': cls.documents_test_folder.id,
        })

        cls.env['mail.activity.type'].search([
            ('category', '=', 'phonecall'),
            ('id', '!=', cls.phonecall_activity.id),
        ]).unlink()

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
            self.env.flush_all()

        with self.assertQueryCount(__system__=1, employee=1):
            record.write({'name': 'New Name'})
            self.env.flush_all()

    @users('employee')
    @warmup
    def test_activity_mixin_schedule_call(self):
        """ Simply check CRUD operations on records having advanced mixing
        enabled. No computed fields are involved. """
        record = self.env['mail.test.sms.bl.activity'].browse(self.test_record.ids)

        with self.assertQueryCount(employee=37):  # TME only: 37
            activity = record.activity_schedule('mail.mail_activity_data_call', summary='Call Activity')
            self.env.flush_all()

        # check business information (to benefits from this test)
        self.assertEqual(record.activity_ids, activity)
        self.assertEqual(activity.user_id, self.user_admin)

    @users('employee')
    @warmup
    def test_activity_mixin_schedule_document(self):
        """ Simply check CRUD operations on records having advanced mixing
        enabled. No computed fields are involved. """
        record = self.env['mail.test.activity.bl.sms.voip'].browse(self.test_record_voip.ids)

        with self.assertQueryCount(employee=42):  # TME only: 421
            activity = record.activity_schedule(
                'mail.mail_activity_data_upload_document',
                summary='Upload Activity')
            self.env.flush_all()

        # check business information (to benefits from this test)
        self.assertEqual(record.activity_ids, activity)
        self.assertEqual(activity.user_id, self.user_admin)

    @users('employee')
    @warmup
    def test_create_call_in_queue(self):
        record = self.env['mail.test.activity.bl.sms.voip'].browse(self.test_record_voip.ids)

        with self.assertQueryCount(employee=14):
            activity = record.create_call_in_queue()

        # check business information (to benefits from this test)
        self.assertEqual(activity.activity_type_id, self.phonecall_activity)
