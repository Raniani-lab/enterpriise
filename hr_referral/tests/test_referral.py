# # -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.exceptions import UserError
from odoo.addons.hr_referral.tests.common import TestHrReferralBase


class TestHrReferral(TestHrReferralBase):

    def test_referral_share_is_new(self):
        self.job_dev = self.job_dev.with_user(self.richard_user.id)

        self.env['hr.referral.link.to.share'].create({'job_id': self.job_dev.id})._compute_url()
        links = self.env['link.tracker'].search([('campaign_id', '=', self.job_dev.utm_campaign_id.id)])
        self.assertEqual(len(links), 1, "It should have created only one link tracker")

        self.env['hr.referral.link.to.share'].with_user(self.steve_user.id).create({'job_id': self.job_dev.id})._compute_url()
        links = self.env['link.tracker'].search([('campaign_id', '=', self.job_dev.utm_campaign_id.id)])
        self.assertEqual(len(links), 2, "It should have created 2 different links tracker (one for each employee)")

    def test_referral_change_referrer(self):
        # Create a job
        job_applicant = self.env['hr.applicant'].create({
            'name': 'Technical worker',
            'description': 'A nice job offer !',
            'job_id': self.job_dev.id,
            'ref_employee_id': self.richard_emp.id
        })
        self.assertEqual(job_applicant.ref_employee_id, self.richard_emp, "Referral is created with the right employee")
        points_richard = self.env['hr.referral.points'].search([('ref_employee_id', '=', self.richard_emp.id)])
        self.assertEqual(job_applicant.stage_id.points, sum(points_richard.mapped('points')), "Right amount of referral points are created.")
        # We change the referrer on the job applicant, Richard will lose all his points and Steve will get points
        job_applicant.ref_employee_id = self.steve_emp.id
        self.assertEqual(job_applicant.ref_employee_id, self.steve_emp, "Referral is modified with as employee Steve")
        points_richard = self.env['hr.referral.points'].search([('ref_employee_id', '=', self.richard_emp.id)])
        self.assertEqual(sum(points_richard.mapped('points')), 0, "Richard has no more points")
        points_steve = self.env['hr.referral.points'].search([('ref_employee_id', '=', self.steve_emp.id)])
        self.assertEqual(sum(points_steve.mapped('points')), job_applicant.stage_id.points, "Right amount of referral points are created for Steve")

    def test_referral_add_points(self):
        with self.assertRaises(UserError):
            self.mug_shop.buy()
        job_applicant = self.env['hr.applicant'].create({
            'name': 'Technical worker',
            'description': 'A nice job offer !',
            'job_id': self.job_dev.id,
            'ref_employee_id': self.richard_emp.id
        })
        self.assertEqual(job_applicant.earned_points, job_applicant.stage_id.points, "Richard received points corresponding to the first stage.")
        stages = self.env['hr.recruitment.stage'].search([('job_ids', '=', False)])
        # We jump some stages of process, multiple points must be given
        job_applicant.stage_id = stages[-2]
        self.assertEqual(job_applicant.earned_points, sum(stages[:-1].mapped('points')), "Richard received points corresponding to the before last stage.")
        self.assertEqual(job_applicant.referral_state, 'progress', "Referral stay in progress")
        job_applicant.stage_id = stages[-1]
        self.assertEqual(job_applicant.earned_points, sum(stages.mapped('points')), "Richard received points corresponding to the last stage.")
        self.assertEqual(job_applicant.referral_state, 'hired', "Referral is hired")
        self.mug_shop.buy()
        shopped_item = self.env['hr.referral.points'].search([('ref_employee_id', '=', self.richard_emp.id), ('hr_referral_reward_id', '!=', False)])
        self.assertEqual(shopped_item.points, -self.mug_shop.cost, "The item bought decrease the number of points.")
