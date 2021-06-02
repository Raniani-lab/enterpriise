# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import json
import requests
import werkzeug
from datetime import timedelta
from werkzeug.urls import url_encode, url_join

from odoo import _, fields, http
from odoo.addons.social.controllers.main import SocialValidationException
from odoo.http import request


class SocialYoutubeController(http.Controller):
    @http.route('/social_youtube/callback', type='http', auth='user')
    def youtube_account_callback(self, code=None, iap_access_token=None, iap_refresh_token=None, iap_expires_in=0, **kw):
        """ Main entry point that receives YouTube information as part of the OAuth flow.
        There are 2 different ways of reaching this method:
        - Database is configured to use 'Own YouTube account'
          This method will receive a 'code' from the YouTube OAuth flow and use it to exchange for a
          pair of valid access_token/refresh_token
        - Using our IAP proxy (for databases with valid enterprise subscriptions)
          This method will directly receive the valid pair of access_token/refresh_token from the
          IAP proxy. """

        if not request.env.user.has_group('social.group_social_manager'):
            return request.render('social.social_http_error_view',
                                  {'error_message': _('Unauthorized. Please contact your administrator.')})

        if (not iap_access_token or not iap_access_token) and not code:
            return request.render(
                'social.social_http_error_view',
                {'error_message': _('YouTube did not provide a valid authorization code.')})

        youtube_oauth_client_id = request.env['ir.config_parameter'].sudo().get_param('social.youtube_oauth_client_id')
        youtube_oauth_client_secret = request.env['ir.config_parameter'].sudo().get_param('social.youtube_oauth_client_secret')

        if iap_access_token and iap_refresh_token:
            access_token = iap_access_token
            refresh_token = iap_refresh_token
            expires_in = iap_expires_in
        else:
            base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
            token_exchange_response = requests.post('https://oauth2.googleapis.com/token', {
                'client_id': youtube_oauth_client_id,
                'client_secret': youtube_oauth_client_secret,
                'code': code,
                'grant_type': 'authorization_code',
                'access_type': 'offline',
                'prompt': 'consent',
                # unclear why 'redirect_uri' is necessary, probably used as a validation by Google
                'redirect_uri': url_join(base_url, 'social_youtube/callback'),
            }).json()

            if token_exchange_response.get('error_description'):
                return request.render('social.social_http_error_view', {
                    'error_message': '\n'.join([
                        token_exchange_response.get('error_description'),
                        _('Reason:'),
                        token_exchange_response.get('error')],
                    )
                })

            if not token_exchange_response.get('refresh_token'):
                return request.render('social.social_http_error_view', {
                    'error_message': _('Auth endpoint did not provide a refresh token. Please try again.')
                })

            access_token = token_exchange_response['access_token']
            refresh_token = token_exchange_response['refresh_token']
            expires_in = token_exchange_response.get('expires_in', 0)

        try:
            self._create_youtube_accounts(access_token, refresh_token, expires_in)
        except SocialValidationException as e:
            return request.render('social.social_http_error_view', {'error_message': str(e)})

        url = '/web?#%s' % url_encode({
            'action': request.env.ref('social.action_social_stream_post').id,
            'view_type': 'kanban',
            'model': 'social.stream.post',
        })
        return werkzeug.utils.redirect(url)

    @http.route('/social_youtube/comment', type='http', auth='user')
    def comment(self, post_id=None, comment_id=None, message=None, is_edit=False, **kwargs):
        post = request.env['social.stream.post'].browse(int(post_id))
        if not post.exists() or post.account_id.media_type != 'youtube':
            return {}
        post.account_id._refresh_youtube_token()

        common_params = {
            'access_token': post.account_id.youtube_access_token,
            'part': 'snippet',
        }

        if comment_id:
            if is_edit:
                # editing own comment
                result_comment = requests.put(
                    url_join(request.env['social.media']._YOUTUBE_ENDPOINT, "youtube/v3/comments"),
                    params=common_params,
                    json={
                        'id': comment_id,
                        'snippet': {
                            'textOriginal': message,
                        }
                    }
                ).json()
            else:
                # reply to comment, uses different endpoint that commenting a video
                result_comment = requests.post(
                    url_join(request.env['social.media']._YOUTUBE_ENDPOINT, "youtube/v3/comments"),
                    params=common_params,
                    json={
                        'snippet': {
                            'textOriginal': message,
                            'parentId': comment_id
                        }
                    }
                ).json()
        else:
            # brand new comment on the video
            result_comment = requests.post(
                url_join(request.env['social.media']._YOUTUBE_ENDPOINT, "youtube/v3/commentThreads"),
                params=common_params,
                json={
                    'snippet': {
                        'topLevelComment': {'snippet': {'textOriginal': message}},
                        'channelId': post.account_id.youtube_channel_id,
                        'videoId': post.youtube_video_id
                    },
                }
            ).json().get('snippet', {}).get('topLevelComment')

        return json.dumps(request.env['social.media']._format_youtube_comment(result_comment))

    def _create_youtube_accounts(self, access_token, refresh_token, expires_in):
        youtube_channels_endpoint = url_join(request.env['social.media']._YOUTUBE_ENDPOINT, "youtube/v3/channels")
        youtube_channels = requests.get(youtube_channels_endpoint, params={
            'mine': 'true',
            'access_token': access_token,
            'part': 'snippet,contentDetails'
        }).json()

        if 'error' in youtube_channels:
            raise SocialValidationException(_('YouTube did not provide a valid access token or it may have expired.'))

        accounts_to_create = []
        existing_accounts = self._get_existing_accounts(youtube_channels)
        youtube_media = request.env.ref('social_youtube.social_media_youtube')
        for channel in youtube_channels.get('items'):
            if channel.get('kind') != 'youtube#channel':
                continue

            account_id = channel['id']
            base_values = {
                'active': True,
                'name': channel['snippet']['title'],
                'youtube_access_token': access_token,
                'youtube_refresh_token': refresh_token,
                'youtube_token_expiration_date': fields.Datetime.now() + timedelta(seconds=int(expires_in)),
                'youtube_upload_playlist_id': channel['contentDetails']['relatedPlaylists']['uploads'],
                'is_media_disconnected': False,
                'image': base64.b64encode(requests.get(
                    channel['snippet']['thumbnails']['medium']['url']).content)
            }

            if existing_accounts.get(account_id):
                existing_accounts.get(account_id).write(base_values)
            else:
                base_values.update({
                    'youtube_channel_id': account_id,
                    'media_id': youtube_media.id,
                    'has_trends': False
                })
                accounts_to_create.append(base_values)

        if accounts_to_create:
            request.env['social.account'].create(accounts_to_create)

    def _get_existing_accounts(self, youtube_channels):
        youtube_accounts_ids = [account['id'] for account in youtube_channels.get('items', [])]
        if youtube_accounts_ids:
            existing_accounts = request.env['social.account'].sudo().with_context(active_test=False).search([
                ('media_id', '=', request.env.ref('social_youtube.social_media_youtube').id),
                ('youtube_channel_id', 'in', youtube_accounts_ids)
            ])

            error_message = existing_accounts._get_multi_company_error_message()
            if error_message:
                raise SocialValidationException(error_message)

            return {
                existing_account.youtube_channel_id: existing_account
                for existing_account in existing_accounts
            }

        return {}
