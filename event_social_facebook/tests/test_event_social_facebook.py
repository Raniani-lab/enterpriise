# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import requests
from unittest.mock import patch

from odoo.addons.social_facebook.tests.common import SocialFacebookCommon


class EventSocialFacebookCase(SocialFacebookCommon):
    @classmethod
    def setUpClass(cls):
        super(EventSocialFacebookCase, cls).setUpClass()

        cls.facebook_events = cls.env['social.facebook.event'].create({
            'name': 'Super event',
            'account_id': cls.social_account.id,
        })

    @classmethod
    def _get_social_media(cls):
        return cls.env['social.media'].create({
            'name': 'Facebook',
            'media_type': 'facebook',
        })

    def _checkPostedStatusEvent(self, success):
        live_posts = self.env['social.live.post'].search([('post_id', '=', self.social_post.id)])

        self.assertEqual(len(live_posts), 3)
        self.assertTrue(all(live_post.state == 'posted' if success else 'failed' for live_post in live_posts))
        self.assertEqual(self.social_post.state, 'posted')

    def _test_post_with_facebook_events(self, success=True):
        self.assertEqual(self.social_post.state, 'draft')
        self.social_post.social_facebook_event_ids = self.facebook_events

        def _patched_post(*args, **kwargs):
            response = requests.Response()
            if success:
                response._content = b'{"id": "42"}'
                response.status_code = 200
            else:
                response._content = b'{"serviceErrorCode": 65600}'
                response.status_code = 404
            return response

        with patch.object(requests, 'post', _patched_post):
            self.social_post._action_post()

        self._checkPostedStatusEvent(success)

    def test_post_with_facebook_events_success(self):
        self._test_post_with_facebook_events()

    def test_post_with_facebook_events_fail(self):
        self._test_post_with_facebook_events(False)
