# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import random
import requests
from contextlib import contextmanager
from unittest.mock import patch
from datetime import datetime

from odoo.tests.common import tagged, HttpCase

from odoo.addons.mail.tests.common import mail_new_test_user


@tagged('-at_install', 'post_install')
class TestSocialTwitter(HttpCase):
    def test_anti_spam_system(self):
        self.social_manager = mail_new_test_user(
            self.env, name='Gustave Doré', login='social_manager', email='social.manager@example.com',
            groups='social.group_social_manager,base.group_user', password='social_manager',
        )

        with self.mock_twitter_call():
            self.media = self.env.ref('social_twitter.social_media_twitter')

            self.social_account = self.env['social.account'].create({
                'media_id': self.media.id,
                'name': 'Social Tour Account',
                'twitter_screen_name': 'social_manager',
                'twitter_oauth_token_secret': 'test_token_key',
            })

            # With social manager to be displayed with the filter "My Streams"
            self.social_stream = self.env['social.stream'].with_user(self.social_manager).create({
                'name': 'Testing Stream',
                'media_id': self.media.id,
                'account_id': self.social_account.id,
                'sequence': 1,
                'stream_type_id': self.env.ref('social_twitter.stream_type_twitter_user_mentions').id,
            })

            self.stream_post = self.env['social.stream.post'].with_user(self.social_manager).create({
                'author_name': 'Author name',
                'message': 'A simple post',
                'stream_id': self.social_stream.id,
                'twitter_tweet_id': 'test_tweet_id',
                'twitter_author_id': 'twitter_author_id',
                'twitter_screen_name': 'author_sreen_name',
                'published_date': datetime.now(),
            })

        self.env['ir.config_parameter'].sudo().set_param('social.twitter_consumer_secret_key', 'test_secret_key')

        with self.mock_twitter_call():
            self.start_tour("/web", 'social_twitter/static/tests/tours/tour_social_twitter_spam.js', login='social_manager')

    @contextmanager
    def mock_twitter_call(self):
        original_request_get = requests.get

        def _mock_request_get(url, *args, **kwargs):
            responses = {
                'tweets.json': {"statuses": []},
                'user_timeline.json': {},
                'mentions_timeline.json': [],
                'users/show.json': {},
            }

            for endpoint, content in responses.items():
                if endpoint in url:
                    response = requests.Response()
                    response._content = json.dumps(content).encode()
                    response.status_code = 200
                    return response

            self.assertNotIn('api.twitter.com', url, 'API call not patched')
            return original_request_get(url, *args, **kwargs)

        original_request_post = requests.post

        def _mock_request_post(url, params=None, data=None, **kwargs):
            params = params or data
            if '/statuses/lookup.json' in url:
                response = requests.Response()
                response._content = b'[]'
                response.status_code = 200
                return response

            if 'statuses/update.json' in url:
                # write a comment
                response = requests.Response()
                response._content = json.dumps({
                    'id_str': random.randint(10 ** 3, 10 ** 5),
                    'full_text': params.get('status'),
                    'created_at': datetime.now().strftime("%Y-%m-%d %H:00:00"),
                    'user': {
                        'id_str': 'social_manager',
                        'name': 'social_manager',
                        'screen_name': 'social_manager',
                        'profile_image_url_https': '',
                    },
                    'in_reply_to_status_id_str': 'test_tweet_id',
                }).encode()
                response.status_code = 200
                return response

            self.assertNotIn('api.twitter.com', url, 'API call not patched')
            return original_request_post(url, params, **kwargs)

        with patch.object(requests, 'get', _mock_request_get), \
             patch.object(requests, 'post', _mock_request_post):
            yield
