# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import dateutil.parser
import requests

from odoo import api, models, fields
from werkzeug.urls import url_join


class SocialStreamPostFacebook(models.Model):
    _inherit = 'social.stream.post'

    FACEBOOK_COMMENT_FIELDS = 'id,from.fields(id,name,picture),message,created_time,attachment,comments.fields(id,from.fields(id,name,picture),message,created_time,attachment,user_likes,likes.limit(0).summary(true)),user_likes,likes.limit(0).summary(true)'

    facebook_post_id = fields.Char('Facebook Post ID', index=True)
    facebook_author_id = fields.Char('Facebook Author ID')
    facebook_likes_count = fields.Integer('Likes')
    facebook_user_likes = fields.Boolean('User Likes')
    facebook_comments_count = fields.Integer('Comments')
    facebook_shares_count = fields.Integer('Shares')
    facebook_reach = fields.Integer('Reach')

    def _compute_author_link(self):
        facebook_posts = self.filtered(lambda post: post.stream_id.media_id.media_type == 'facebook')
        super(SocialStreamPostFacebook, (self - facebook_posts))._compute_author_link()

        for post in facebook_posts:
            post.author_link = 'https://www.facebook.com/%s' % post.facebook_author_id

    def _compute_post_link(self):
        facebook_posts = self.filtered(lambda post: post.stream_id.media_id.media_type == 'facebook')
        super(SocialStreamPostFacebook, (self - facebook_posts))._compute_post_link()

        for post in facebook_posts:
            post.post_link = 'https://www.facebook.com/%s' % post.facebook_post_id

    def get_facebook_comments(self, next_records_token=False):
        self.ensure_one()

        comments_endpoint_url = url_join(self.env['social.media']._FACEBOOK_ENDPOINT, "/v3.3/%s/comments" % (self.facebook_post_id))
        params = {
            'fields': self.FACEBOOK_COMMENT_FIELDS,
            'access_token': self.stream_id.account_id.facebook_access_token,
            'summary': 1,
            'limit': 20,
            'order': 'reverse_chronological'
        }
        if next_records_token:
            params['after'] = next_records_token

        result = requests.get(comments_endpoint_url, params)

        result_json = result.json()
        for comment in result_json.get('data'):
            comment['formatted_created_time'] = self._format_facebook_published_date(comment)
            inner_comments = comment.get('comments', {}).get('data', [])
            for inner_comment in inner_comments:
                inner_comment['formatted_created_time'] = self._format_facebook_published_date(inner_comment)

        return {
            'comments': result_json.get('data'),
            'summary': result_json.get('summary'),
            'nextRecordsToken': result_json.get('paging').get('cursors').get('after') if result_json.get('paging') else None
        }

    @api.model
    def _format_facebook_published_date(self, comment):
        return self.env['social.stream.post']._format_published_date(fields.Datetime.from_string(
            dateutil.parser.parse(comment.get('created_time')).strftime('%Y-%m-%d %H:%M:%S')
        ))

    def like_facebook_post(self, like):
        self.ensure_one()
        self._like_facebook_object(self.facebook_post_id, like)

    def like_facebook_comment(self, comment_id, like):
        self.ensure_one()
        self._like_facebook_object(comment_id, like)

    def delete_facebook_comment(self, comment_id):
        self.ensure_one()
        comments_endpoint_url = url_join(self.env['social.media']._FACEBOOK_ENDPOINT, "/v3.3/%s" % comment_id)
        requests.delete(comments_endpoint_url, data={
            'access_token': self.stream_id.account_id.facebook_access_token,
        })

    def _edit_facebook_comment(self, message, comment_id, existing_attachment_id=None, attachment=None):
        self.ensure_one()

        return self._post_facebook_comment(
            url_join(self.env['social.media']._FACEBOOK_ENDPOINT, "/v3.3/%s" % comment_id),
            message,
            existing_attachment_id=existing_attachment_id,
            attachment=attachment
        )

    def _add_facebook_comment(self, message, comment_id, existing_attachment_id=None, attachment=None):
        self.ensure_one()

        return self._post_facebook_comment(
            url_join(self.env['social.media']._FACEBOOK_ENDPOINT, "/v3.3/%s/comments" % (comment_id)),
            message,
            existing_attachment_id=existing_attachment_id,
            attachment=attachment
        )

    def _post_facebook_comment(self, endpoint_url, message, existing_attachment_id=None, attachment=None):
        params = {
            'message': message,
            'access_token': self.stream_id.account_id.facebook_access_token,
            'fields': self.FACEBOOK_COMMENT_FIELDS
        }

        if existing_attachment_id:
            params.update({'attachment_id': existing_attachment_id})

        extracted_url = self.env['social.post']._extract_url_from_message(message)
        # can't combine with images
        if extracted_url and not attachment and not existing_attachment_id:
            params.update({'link': extracted_url})

        result = requests.post(
            endpoint_url,
            params,
            files={'source': ('source', attachment.read(), attachment.content_type)} if attachment else None
        )

        return result.json()

    def _like_facebook_object(self, object_id, like):
        params = {'access_token': self.stream_id.account_id.facebook_access_token}
        comments_like_endpoint_url = url_join(self.env['social.media']._FACEBOOK_ENDPOINT, "/v3.3/%s/likes" % (object_id))
        if like:
            requests.post(comments_like_endpoint_url, params)
        else:
            requests.delete(comments_like_endpoint_url, data=params)
