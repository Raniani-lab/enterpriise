# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.website_helpdesk.controllers import main


class WebsiteHelpdesk(main.WebsiteHelpdesk):

    def _format_search_results(self, search_type, records, options):
        if search_type != 'slides':
            return super()._format_search_results(search_type, records, options)

        if records._name == 'slide.slide':
            return [{
                'template': 'website_helpdesk_slides.search_result',
                'record': slide,
                'score': slide.total_views + slide.comments_count + slide.likes - slide.dislikes,
                'url': slide.website_url if slide.is_preview or slide.channel_id.is_member else slide.channel_id.website_url,
                'icon': 'fa-graduation-cap',
            } for slide in records]
        # slide.channel
        return [{
            'template': 'website_helpdesk_slides.channel_search_result',
            'record': channel,
            'score': channel.total_views + channel.total_votes,
            'url': channel.website_url,
            'icon': 'fa-graduation-cap',
        } for channel in records]
