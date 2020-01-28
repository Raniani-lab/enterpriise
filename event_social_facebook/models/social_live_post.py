# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class SocialLivePost(models.Model):
    _inherit = 'social.live.post'

    social_facebook_event_id = fields.Many2one(
        'social.facebook.event',
        string='Facebook Event',
        help="The events on which this post will be published.")

    def _post(self):
        facebook_event_live_posts = self.filtered(
            lambda post: post.account_id.media_type == 'facebook' and post.social_facebook_event_id)
        super(SocialLivePost, (self - facebook_event_live_posts))._post()

        for live_post in facebook_event_live_posts:
            live_post._post_facebook(live_post.social_facebook_event_id.facebook_event_identifier)
