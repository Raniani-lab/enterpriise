# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo import models, fields


class SocialStreamPost(models.Model):
    """ A 'stream' post, as opposed to a regular social.post, references a post that
    actually exists on a social.media external database (a Facebook post, a Tweet, ...).

    Stream posts are created by fetching data from the related social media third party API.
    They should not be directly created/modified.

    social.stream.posts are used to fill the 'Feed' view that allows users to follow the social.media activity
    based on their interest (a Facebook Page, a Twitter hashtag, ...).
    They are directly created by their related social.stream. """

    _name = 'social.stream.post'
    _description = 'Social Stream Post'
    _order = 'published_date desc'

    message = fields.Text("Message")
    author_name = fields.Char('Author Name',
        help="The post author name based on third party information (ex: 'John Doe').")
    post_link = fields.Char('Post Link', compute='_compute_post_link',
        help="Post link to the external social.media (ex: link to the actual Facebook Post).")
    stream_id = fields.Many2one('social.stream', string="Social Stream", ondelete="cascade")
    media_type = fields.Selection(related='stream_id.media_id.media_type', string="Related Social Media")
    published_date = fields.Datetime('Published date', help="The post published date based on third party information.")
    account_id = fields.Many2one(related='stream_id.account_id', string='Related social Account')

    stream_post_image_ids = fields.One2many('social.stream.post.image', 'stream_post_id', string="Stream Post Images",
        help="Images that were shared with this post.")
    stream_post_image_urls = fields.Text("Stream Post Images URLs",
        help="JSON array capturing the URLs of the images to make it easy to display them in the kanban view",
        compute='_compute_stream_post_image_urls')

    # Some social.medias (ex: Facebook) provide information on the link shared with the post.
    # We store those infomation to render a nice block on the kanban view with the title, image and description.
    link_title = fields.Text("Link Title")
    link_description = fields.Text("Link Description")
    link_image_url = fields.Char("Link Image URL")
    link_url = fields.Char("Link URL")

    def _compute_stream_post_image_urls(self):
        """ See field 'help' for more information. """
        for stream_post in self:
            stream_post.stream_post_image_urls = json.dumps([image.image_url for image in stream_post.stream_post_image_ids])

    def _compute_post_link(self):
        """ Every social module should override this method.
        See field 'help' for more information. """
        pass
