# -*- coding: utf-8 -*-
import re
from html2text import html2text

from odoo import models, api
from odoo.addons.iap import jsonrpc


class MailThread(models.AbstractModel):
    _inherit = 'mail.thread'

    @api.multi
    def _notify_compute_recipients(self, message, msg_vals):
        """ We want to send a Cloud notification for every mentions of a partner
        and every direct message. We have to take into account the risk of
        duplicated notifications in case of a mention in a channel of `chat` type.
        """

        rdata = super(MailThread, self)._notify_compute_recipients(message, msg_vals)
        notif_pids = [r['id'] for r in rdata['partners'] if r['active']]
        chat_cids = [r['id'] for r in rdata['channels'] if r['type'] == 'chat']

        if not notif_pids and not chat_cids:
            return rdata

        msg_sudo = message.sudo()  # why sudo?
        msg_type = msg_vals.get('message_type') or msg_sudo.message_type

        if msg_type == 'comment':
            # Create Cloud messages for needactions, but ignore the needaction if it is a result
            # of a mention in a chat. In this case the previously created Cloud message is enough.

            if chat_cids:
                # chat_cids should all exists since they come from get_recipient_data
                channel_partner_ids = self.env['mail.channel'].sudo().browse(chat_cids).mapped("channel_partner_ids").ids
            else:
                channel_partner_ids = []
            author_id = [msg_vals.get('author_id')] or message.author_id.ids
            pids = (set(notif_pids) | set(channel_partner_ids)) - set(author_id)
            if pids:
                # only reason we would want to make a search instead of a browse is to avoid inactive partner,
                # not sure 'mapped' is filtering that, to check.
                receiver_ids = self.env['res.partner'].sudo().browse(pids)
                identities = receiver_ids.filtered(lambda receiver: receiver.ocn_token).mapped('ocn_token')
                if identities:
                    endpoint = self.env['res.config.settings']._get_endpoint()
                    params = {
                        'ocn_tokens': identities,
                        'data': self._ocn_prepare_payload(message, msg_vals)
                    }
                    jsonrpc(endpoint + '/iap/ocn/send', params=params)
        return rdata

    @api.model
    def _ocn_prepare_payload(self, message, msg_vals):
        """Returns dictionary containing message information for mobile device.
        This info will be delivered to mobile device via Google Firebase Cloud
        Messaging (FCM). And it is having limit of 4000 bytes (4kb)
        """
        author_id = [msg_vals.get('author_id')] or message.author_id.ids
        author_name = self.env['res.partner'].browse(author_id).name
        model = msg_vals.get('model') if msg_vals else message.model
        res_id = msg_vals.get('res_id') if msg_vals else message.res_id
        record_name = msg_vals.get('record_name') if msg_vals else message.record_name
        subject = msg_vals.get('subject') if msg_vals else message.subject

        payload = {
            "author_name": author_name,
            "model": model,
            "res_id": res_id,
            "db_id": self.env['res.config.settings']._get_ocn_uuid()
        }
        if model == 'mail.channel':
            # todo xdo could we just browse res_id? or are we using the fact that res_id could not be in channel_ids?
            channel = message.channel_ids.filtered(lambda r: r.id == res_id)
            if channel.channel_type == 'chat':
                payload['subject'] = author_name
                payload['type'] = 'chat'
            else:
                payload['subject'] = "#%s" % (record_name)
        else:
            payload['subject'] = record_name or subject
        payload_length = len(str(payload).encode("utf-8"))
        if payload_length < 4000:
            body = msg_vals.get('body') if msg_vals else message.body
            body = re.sub(r'<a(.*?)>', r'<a>', body)  # To-Do : Replace this fix
            payload['body'] = html2text(body)[:4000 - payload_length]
        return payload
