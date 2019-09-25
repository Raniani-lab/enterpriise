# -*- coding: utf-8 -*-

import requests

from odoo import models, fields


class SocialLivePostLinkedin(models.Model):
    _inherit = 'social.live.post'

    linkedin_post_id = fields.Char('Actual LinkedIn ID of the post')

    def _post(self):
        linkedin_live_posts = self.filtered(lambda post: post.account_id.media_type == 'linkedin')
        super(SocialLivePostLinkedin, (self - linkedin_live_posts))._post()

        linkedin_live_posts._post_linkedin()

    def _post_linkedin(self):
        for live_post in self:
            message_with_shortened_urls = self.env['link.tracker'].sudo()._convert_links_text(live_post.post_id.message, live_post._get_utm_values())

            data = {
                "author": live_post.account_id.linkedin_account_id,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {
                            "text": message_with_shortened_urls
                        },
                        "shareMediaCategory": "NONE"
                    }
                },
                "visibility": {
                    # PUBLIC or CONNECTIONS
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }

            url_in_message = self.env['social.post']._extract_url_from_message(message_with_shortened_urls)

            if len(live_post.post_id.image_ids) >= 1:
                images_urn = [
                    self._likedin_upload_image(live_post.account_id, image_id)
                    for image_id in live_post.post_id.image_ids
                ]

                data['specificContent']['com.linkedin.ugc.ShareContent']['shareMediaCategory'] = 'IMAGE'

                data['specificContent']['com.linkedin.ugc.ShareContent']['media'] = [
                    {
                        "status": "READY",
                        "description": {"text": ""},
                        "media": image_urn,
                        "title": {"text": ""}
                    }
                    for image_urn in images_urn
                ]

            elif url_in_message:
                data['specificContent']['com.linkedin.ugc.ShareContent']['shareMediaCategory'] = 'ARTICLE'
                data['specificContent']['com.linkedin.ugc.ShareContent']['media'] = [
                    {
                        "status": "READY",
                        "description": {"text": ""},
                        "originalUrl": url_in_message,
                        "title": {"text": ""}
                    }
                ]

            response = requests.post(
                self.env['social.media']._LINKEDIN_ENDPOINT+'ugcPosts',
                headers=live_post.account_id._bearer_headers(),
                json=data).json()

            response_id = response.get('id')
            values = {
                'state': 'posted' if response_id else 'failed',
                'failure_reason': False
            }
            if response_id:
                values['linkedin_post_id'] = response_id
            else:
                values['failure_reason'] = response.get('message', 'unknown')

            if response.get('message') == 'Invalid access token':
                self.account_id.write({'is_media_disconnected': True})

            live_post.write(values)

    def _likedin_upload_image(self, account_id, image_id):
        """
        Upload all images of the `live_post`
        """

        # 1 - Register your image to be uploaded
        data = {
            "registerUploadRequest": {
                "recipes": [
                    "urn:li:digitalmediaRecipe:feedshare-image"
                ],
                "owner": account_id.linkedin_account_id,
                "serviceRelationships": [
                    {
                        "relationshipType": "OWNER",
                        "identifier": "urn:li:userGeneratedContent"
                    }
                ]
            }
        }

        response = requests.post(
                self.env['social.media']._LINKEDIN_ENDPOINT+'assets?action=registerUpload',
                headers=account_id._bearer_headers(),
                json=data).json()

        if 'value' not in response or 'asset' not in response['value']:
            raise Exception('Failed during upload registering')

        # 2 - Upload image binary file
        upload_url = response['value']['uploadMechanism']['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']['uploadUrl']
        image_urn = response['value']['asset']

        file = open(image_id._full_path(image_id.store_fname), 'rb').read()

        headers = account_id._bearer_headers()
        headers['Content-Type'] = 'application/octet-stream'

        response = requests.request(
            'POST',
            upload_url,
            data=file,
            headers=headers)

        if response.status_code != 201:
            raise Exception('Failed during image upload')

        return image_urn

    def _refresh_live_posts_statistics(self):
        # TODO - STD: need r_member_social permission :(
        super(SocialLivePostLinkedin, self)._refresh_live_posts_statistics()
