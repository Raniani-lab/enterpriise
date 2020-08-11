# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import requests

from unittest.mock import patch

from odoo.addons.social_twitter.models.social_account import SocialAccountTwitter
from odoo.addons.social.tests.common import SocialCase


class SocialTwitterCase(SocialCase):
    @classmethod
    def setUpClass(cls):
        with patch.object(SocialAccountTwitter, '_compute_statistics', lambda x: None), \
             patch.object(SocialAccountTwitter, '_create_default_stream_twitter', lambda *args, **kwargs: None):
            super(SocialTwitterCase, cls).setUpClass()

            cls.social_accounts.write({
                'twitter_oauth_token_secret': 'ABCD'
            })

            cls.env['ir.config_parameter'].sudo().set_param('social.twitter_consumer_key', 'key')
            cls.env['ir.config_parameter'].sudo().set_param('social.twitter_consumer_secret_key', 'secret_key')

    def test_post_success(self):
        self._test_post()

    def test_post_failure(self):
        self._test_post(False)

    def _test_post(self, success=True):
        self.assertEqual(self.social_post.state, 'draft')

        def _patched_post(*args, **kwargs):
            response = requests.Response()
            if success:
                response._content = json.dumps({'id_str': '42'}).encode('utf-8')
                response.status_code = 200
            else:
                response.status_code = 404
            return response

        with patch.object(SocialAccountTwitter, '_format_images_twitter', lambda *args, **kwargs: ['media1', 'media2']), \
             patch.object(requests, 'post', _patched_post):
                self.social_post._action_post()

        self._checkPostedStatus(success)

    @classmethod
    def _get_social_media(cls):
        return cls.env.ref('social_twitter.social_media_twitter')

    def test_remove_mentions(self):
        # without `ignore_mention` parameter
        assert_results = [
            ["@mister hello", "@ mister hello"],
            ["111@mister hello", "111@mister hello"],
            ["hello @mister", "hello @ mister"],
            ["hello@gmail.com hello @mister", "hello@gmail.com hello @ mister"],
            ["#@mister hello", "#@mister hello"],
            ["@aa @bb @cc", "@ aa @ bb @ cc"],
            ["@@test", "@@ test"],
            ['"@test"', '"@ test"'],
        ]
        for message, expected in assert_results:
            self.assertEqual(self.env["social.live.post"]._remove_mentions(message), expected)

        # with `ignore_mention` parameter
        assert_results = [
            ["@mister hello", ["mister"], "@mister hello"],
            ["@mister hello", ["MISTER"], "@mister hello"],
            ["@mistER hello", ["@MistEr"], "@mistER hello"],
            ["@ mister this_is_an_email@mister7f.com @kiwi", ["kiwi"], "@ mister this_is_an_email@mister7f.com @kiwi"],
            ["this_is_an_email@mister7f.com @mister @kiwi", ["kiwi"], "this_is_an_email@mister7f.com @ mister @kiwi"],
            ["@Mister hello @miste ", ["mister"], "@Mister hello @ miste "],
            ["@Mister hello @miste @TEST", ["mister", "test"], "@Mister hello @ miste @TEST"],
            # will remove `mister_kiwi_12` but must keep `mister_kiwi_123`
            ["special mention @mister_kiwi_123 @mister_kiwi_12", ["mister_kiwi_123"], "special mention @mister_kiwi_123 @ mister_kiwi_12"],
            ["@mister_kiwi_123 @mister_kiwi_12", ["mister_kiwi_123"], "@mister_kiwi_123 @ mister_kiwi_12"],
            ["@mister_kiwi_12 @mister_kiwi_123", ["mister_kiwi_123"], "@ mister_kiwi_12 @mister_kiwi_123"],
        ]
        for message, ignore, expected in assert_results:
            self.assertEqual(self.env["social.live.post"]._remove_mentions(message, ignore), expected)
