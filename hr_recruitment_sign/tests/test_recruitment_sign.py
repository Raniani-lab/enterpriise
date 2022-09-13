# # -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.exceptions import UserError
from odoo.tests import tagged, HttpCase

@tagged('post_install', '-at_install')
class TestHrRecruitmentSign(HttpCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.applicant = cls.env['hr.applicant'].create({
            'name': 'Caped Baldy',
        })

    def test_send_applicant_sign_request(self):
        with self.assertRaises(UserError):
            # can't unlink the campaign as it's used by a job as it's referral campaign
            # unlinking the campaign would break sent referral links
            self.applicant._send_applicant_sign_request()

        self.applicant.write({
            'partner_name': 'Saitama',
            'email_from': 'caped.baldy@heroassociation.net',
        })
        self.start_tour("/web", 'applicant_sign_request_tour', login='admin', timeout=300)

        self.assertEqual(self.applicant.sign_request_count, 1)
        self.assertEqual(self.applicant.emp_id.sign_request_count, 1)
