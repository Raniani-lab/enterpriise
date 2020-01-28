# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class SocialPost(models.Model):
    _inherit = 'social.post'

    social_facebook_event_ids = fields.Many2many(
        'social.facebook.event',
        string='Facebook Events',
        help="The events on which this post will be published.")

    def _has_no_accounts(self):
        self.ensure_one()
        return not self.social_facebook_event_ids and super(SocialPost, self)._has_no_accounts()

    @api.depends('message', 'account_ids.media_id.media_type', 'social_facebook_event_ids')
    def _compute_display_facebook_preview(self):
        for post in self:
            post.display_facebook_preview = post.message and ('facebook' in post.account_ids.media_id.mapped('media_type') or post.social_facebook_event_ids)

    def _prepare_live_post_values(self):
        """Append live.posts values related to the selected Facebook events on the social.post."""
        self.ensure_one()

        live_post_values = super(SocialPost, self)._prepare_live_post_values()

        live_post_values.extend([{
            'post_id': self.id,
            'account_id': social_facebook_event.account_id.id,
            'social_facebook_event_id': social_facebook_event.id
        } for social_facebook_event in self.social_facebook_event_ids])

        return live_post_values
