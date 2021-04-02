# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import requests
from dateutil.relativedelta import relativedelta
from werkzeug.urls import url_join

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class SocialStreamPostYoutube(models.Model):
    _inherit = 'social.stream.post'

    youtube_video_id = fields.Char('YouTube Video ID', index=True)
    youtube_likes_count = fields.Integer('YouTube Likes')
    youtube_dislikes_count = fields.Integer('YouTube Dislikes')
    youtube_comments_count = fields.Integer('YouTube Comments Count')
    youtube_views_count = fields.Integer('YouTube Views')
    youtube_video_duration = fields.Float('YouTube Video Duration')  # in minutes

    def _compute_author_link(self):
        youtube_posts = self.filtered(lambda post: post.stream_id.media_id.media_type == 'youtube')
        super(SocialStreamPostYoutube, (self - youtube_posts))._compute_author_link()

        for post in youtube_posts:
            post.author_link = 'http://www.youtube.com/channel/%s' % (post.stream_id.account_id.youtube_channel_id)

    def _compute_post_link(self):
        youtube_posts = self.filtered(lambda post: post.stream_id.media_id.media_type == 'youtube')
        super(SocialStreamPostYoutube, (self - youtube_posts))._compute_post_link()

        for post in youtube_posts:
            post.post_link = 'https://www.youtube.com/watch?v=%s' % post.youtube_video_id

    def get_youtube_comments(self, next_page_token=False):
        self.ensure_one()
        self.stream_id.account_id._refresh_youtube_token()

        comments_endpoint_url = url_join(self.env['social.media']._YOUTUBE_ENDPOINT, "youtube/v3/commentThreads")
        params = {
            'part': 'snippet,replies',
            'textFormat': 'plainText',
            'access_token': self.stream_id.account_id.youtube_access_token,
            'videoId': self.youtube_video_id
        }

        if next_page_token:
            params['pageToken'] = next_page_token

        result = requests.get(comments_endpoint_url, params)
        result_json = result.json()

        if not result.ok:
            error_message = _('An error occurred.')

            if result_json.get('error'):
                error_code = result_json['error'].get('code')
                error_reason = result_json['error'].get('errors', [{}])[0].get('reason')
                if error_code == 404 and error_reason == 'videoNotFound':
                    error_message = _("Video not found. It could have been removed from Youtube.")
                elif error_code == 403 and error_reason == 'commentsDisabled':
                    error_message = _("Comments are marked as 'disabled' for this video. It could have been set as 'private'.")

            raise UserError(error_message)

        comments = []
        for comment in result_json.get('items', []):
            youtube_comment = self.env['social.media']._format_youtube_comment(
                comment.get('snippet').get('topLevelComment'))

            youtube_comment_replies = [
                self.env['social.media']._format_youtube_comment(reply)
                for reply in list(reversed(comment.get('replies', {}).get('comments', [])))]
            if youtube_comment_replies:
                youtube_comment['comments'] = {
                    'data': youtube_comment_replies
                }

            comments.append(youtube_comment)

        return {
            'comments': comments,
            'nextPageToken': result_json.get('nextPageToken')
        }

    def delete_youtube_comment(self, comment_id):
        self.ensure_one()
        self.account_id._refresh_youtube_token()

        response = requests.delete(
            url=url_join(self.env['social.media']._YOUTUBE_ENDPOINT, 'youtube/v3/comments'),
            params={
                'id': comment_id,
                'access_token': self.account_id.youtube_access_token,
            }
        )

        if not response.ok:
            self.account_id.sudo().write({'is_media_disconnected': True})

    @api.autovacuum
    def _gc_youtube_data(self):
        """ According to Youtube API terms of service, users Youtube data have to be removed
        if they have not been updated for more than 30 days.
        Ref: https://developers.google.com/youtube/terms/developer-policies#e.-handling-youtube-data-and-content
        (Section 4. "Refreshing, Storing, and Displaying API Data") """

        youtube_stream = self.env.ref('social_youtube.stream_type_youtube_channel_videos')
        self.env['social.stream.post'].sudo().search([
            ('stream_id.stream_type_id', '=', youtube_stream.id),
            ('write_date', '<', fields.Datetime.now() - relativedelta(days=30))
        ]).unlink()
