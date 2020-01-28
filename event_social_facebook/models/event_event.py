# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api
from odoo.tools import plaintext2html


class Event(models.Model):
    _inherit = 'event.event'

    social_event_id = fields.Many2one(
        'social.facebook.event', 'Facebook event',
        help='First create an event on Facebook, then link this event to the Facebook event')

    social_attending_count = fields.Integer(related='social_event_id.attending_count')
    social_interested_count = fields.Integer(related='social_event_id.interested_count')
    social_maybe_count = fields.Integer(related='social_event_id.maybe_count')
    social_noreply_count = fields.Integer(related='social_event_id.noreply_count')
    social_declined_count = fields.Integer(related='social_event_id.declined_count')

    @api.onchange('social_event_id')
    def _onchange_social_event_id(self):
        if self.social_event_id:
            if not self.name:
                self.name = self.social_event_id.name
            if not self.date_begin:
                self.date_begin = self.social_event_id.date_begin
            if not self.date_end:
                self.date_end = self.social_event_id.date_end
            if not self.description:
                self.description = plaintext2html(self.social_event_id.description)

    def action_add_post(self):
        action = self.env.ref('social.action_social_post').read()[0]
        action.update({
            'views': [[False, 'form']],
            'context': {
                'default_social_facebook_event_ids': [self.social_event_id.id]
            }
        })
        return action
