# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _

class HelpdeskTeam(models.Model):
    _inherit = "helpdesk.team"

    @api.model
    def _get_knowledge_base_fields(self):
        return super()._get_knowledge_base_fields() + ['use_website_helpdesk_slides']

    def _helpcenter_filter_types(self):
        res = super()._helpcenter_filter_types()
        if not self.use_website_helpdesk_slides:
            return res

        res['slides'] = _('Courses')
        return res

    def _helpcenter_filter_tags(self):
        res = super()._helpcenter_filter_tags()
        if not self.use_website_helpdesk_slides:
            return res

        course_tags = self.env['slide.tag'].search([])
        channel_tags = self.env['slide.channel.tag'].search([])
        return res + course_tags.mapped(lambda t: t.name and t.name.lower()) + channel_tags.mapped(lambda t: t.name and t.name.lower())
