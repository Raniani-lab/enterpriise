# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import dateutil.parser
import requests
from werkzeug.urls import url_join

from odoo import api, fields, models, _
from odoo.exceptions import AccessError


class SocialFacebookEvent(models.Model):
    _name = 'social.facebook.event'
    _description = 'Social Facebook Event'
    _order = 'date_begin'

    _FACEBOOK_EVENT_FIELDS = [
        'id', 'name', 'description', 'start_time', 'end_time', 'cover{source}',
        'attending_count', 'interested_count', 'maybe_count', 'declined_count', 'noreply_count'
    ]

    name = fields.Char('Name', required=True)
    description = fields.Text('Description')
    date_begin = fields.Datetime('Date begin')
    date_end = fields.Datetime('Date end')

    account_id = fields.Many2one(
        'social.account', string='Social Account',
        help='The Facebook account link to the event.',
        required=True, ondelete='cascade')
    media_id = fields.Many2one(string='Facebook media', related='account_id.media_id')

    # stats related to the Facebook event
    facebook_event_identifier = fields.Char('Facebook ID of the event')
    attending_count = fields.Integer('Attendee count', help='Number of people attending')
    interested_count = fields.Integer('Interest count', help='Number of people interested')
    maybe_count = fields.Integer('Maybe count', help='Number of people who replied "maybe"')
    declined_count = fields.Integer('Decline count', help='Number of people who declined')
    noreply_count = fields.Integer('Ignore count', help='Number of people who ignored')

    @api.model
    def fetch_facebook_events(self):
        if not self.env.user.has_group('event.group_event_user') and not self.env.user.has_group('social.group_social_user'):
            raise AccessError(_('You must be event/social user to synchronize the Facebook events.'))

        facebook_accounts = self.env['social.account'].sudo().search([('media_type', '=', 'facebook')])
        if not facebook_accounts:
            return

        social_events_to_create = []
        facebook_id_to_event_mapping = {
            social_event_id.facebook_event_identifier: social_event_id
            for social_event_id in self.env['social.facebook.event'].sudo().search([])
        }

        for account_id in facebook_accounts:
            result_json = requests.get(
                url_join(self.env['social.media']._FACEBOOK_ENDPOINT, "/v4.0/%s/events" % account_id.facebook_account_id),
                params={
                    'access_token': account_id.facebook_access_token,
                    'fields': ','.join(self.env['social.facebook.event']._FACEBOOK_EVENT_FIELDS),
                }).json()

            for event in result_json.get('data', []):
                values = {
                    'name': event.get('name'),
                    'account_id': account_id.id,
                    'description': event.get('description'),
                    'facebook_event_identifier': event.get('id'),
                    'date_begin': self._parse_facebook_date(event.get('start_time')),
                    'date_end': self._parse_facebook_date(event.get('end_time')),
                    'attending_count': event.get('attending_count'),
                    'interested_count': event.get('interested_count'),
                    'maybe_count': event.get('maybe_count'),
                    'declined_count': event.get('declined_count'),
                    'noreply_count': event.get('noreply_count')
                }

                if values['facebook_event_identifier'] in facebook_id_to_event_mapping:
                    facebook_id_to_event_mapping[values['facebook_event_identifier']].write(values)
                else:
                    social_events_to_create.append(values)

        if social_events_to_create:
            return self.env['social.facebook.event'].sudo().create(social_events_to_create)

    def _parse_facebook_date(self, date_str):
        if not date_str:
            return False

        return fields.Datetime.from_string(
            dateutil.parser.parse(date_str).strftime('%Y-%m-%d %H:%M:%S'))

    def name_get(self):
        return [
            (event.id, '[%s] - %s' % (event.sudo().account_id.name, event.name))
            for event in self
        ]
