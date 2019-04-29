# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import fields, models



class HrReferralPoints(models.Model):
    _name = 'hr.referral.points'
    _description = 'Points line for referrals'
    _rec_name = 'points'

    applicant_id = fields.Many2one('hr.applicant')
    hr_referral_reward_id = fields.Many2one('hr.referral.reward')
    ref_employee_id = fields.Many2one('hr.employee', required=True, string='Employee')
    points = fields.Integer('Points')
    stage_id = fields.Many2one('hr.recruitment.stage', 'Stage')
    sequence_stage = fields.Integer('Sequence of stage', related='stage_id.sequence')
