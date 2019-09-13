# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class MarketingCampaign(models.Model):
    _inherit = 'marketing.campaign'

    mailing_sms_count = fields.Integer('# SMS Mailings', compute='_compute_mailing_sms_count')

    @api.depends('marketing_activity_ids.mass_mailing_id.mailing_type')
    def _compute_mailing_sms_count(self):
        # TDE NOTE: this could be optimized but is currently displayed only in a form view, no need to optimize now
        for campaign in self:
            campaign.mailing_sms_count = len(campaign.mapped('marketing_activity_ids.mass_mailing_id').filtered(lambda mailing: mailing.mailing_type == 'sms'))
