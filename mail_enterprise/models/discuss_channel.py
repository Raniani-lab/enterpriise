# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models


class DiscussChannel(models.Model):
    _inherit = 'discuss.channel'

    def _notify_thread_by_web_push(self, message, recipients_data, msg_vals=False, **kwargs):
        """ Specifically handle channel members. """
        chat_channels = self.filtered(lambda channel: channel.channel_type == 'chat')
        if chat_channels:
            # modify rdata only for calling super. Do not deep copy as we only
            # add data into list but we do not modify item content
            channel_rdata = recipients_data.copy()
            channel_rdata += [
                {'id': partner.id,
                 'share': partner.partner_share,
                 'active': partner.active,
                 'notif': 'web_push',
                 'type': 'customer',
                 'groups': [],
                }
                for partner in chat_channels.mapped("channel_partner_ids")
            ]
        else:
            channel_rdata = recipients_data

        return super()._notify_thread_by_web_push(message, channel_rdata, msg_vals=msg_vals, **kwargs)

    def _notify_by_web_push_prepare_payload(self, message, msg_vals=False):
        payload = super()._notify_by_web_push_prepare_payload(message, msg_vals=msg_vals)
        payload['options']['data']['action'] = 'mail.action_discuss'
        record_name = msg_vals.get('record_name') if msg_vals and 'record_name' in msg_vals else message.record_name
        if self.channel_type == 'chat':
            author_id = [msg_vals.get('author_id')] if 'author_id' in msg_vals else message.author_id.ids
            payload['title'] = self.env['res.partner'].browse(author_id).name
            payload['options']['icon'] = '/discuss/channel/%d/partner/%d/avatar_128' % (message.res_id, author_id[0])
        elif self.channel_type == 'channel':
            author_id = [msg_vals.get('author_id')] if 'author_id' in msg_vals else message.author_id.ids
            author_name = self.env['res.partner'].browse(author_id).name
            payload['title'] = "#%s - %s" % (record_name, author_name)
        else:
            payload['title'] = "#%s" % (record_name)
        return payload
