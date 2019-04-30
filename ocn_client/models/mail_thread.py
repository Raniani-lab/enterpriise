# -*- coding: utf-8 -*-
import re
from html2text import html2text

from odoo import _, models, api
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

        if not self.env['ir.config_parameter'].sudo().get_param('odoo_ocn.project_id'):
            return rdata

        notif_pids = []
        no_inbox_pids = []
        for r in rdata['partners']:
            if r['active']:
                notif_pids.append(r['id'])
                if r['notif'] != 'inbox':
                    no_inbox_pids.append(r['id'])

        chat_cids = [r['id'] for r in rdata['channels'] if r['type'] == 'chat']

        if not notif_pids and not chat_cids:
            return rdata

        msg_sudo = message.sudo()  # why sudo?
        msg_type = msg_vals.get('message_type') or msg_sudo.message_type
        author_id = [msg_vals.get('author_id')] or message.author_id.ids

        if msg_type == 'comment':
            if chat_cids:
                # chat_cids should all exists since they come from get_recipient_data
                channel_partner_ids = self.env['mail.channel'].sudo().browse(chat_cids).mapped("channel_partner_ids").ids
            else:
                channel_partner_ids = []
            pids = (set(notif_pids) | set(channel_partner_ids)) - set(author_id)
            self._send_notification_to_partners(pids, message, msg_vals)
        elif msg_type == 'notification' or msg_type == 'user_notification':
            # Send notification to partners except for the author and those who
            # doesn't want to handle notifications in Odoo.
            pids = (set(notif_pids) - set(author_id) - set(no_inbox_pids))
            self._send_notification_to_partners(pids, message, msg_vals)
        return rdata

    @api.model
    def _send_notification_to_partners(self, pids, message, msg_vals):
        """
        Send the notification to a list of partners
        :param pids: list of partners
        :param message: current mail.message record
        :param msg_vals: dict values for current notification
        """
        if pids:
            receiver_ids = self.env['res.partner'].sudo().search([
                ('id', 'in', list(pids)),
                ('ocn_token', '!=', False)
            ])
            identities = receiver_ids.mapped('ocn_token')
            if identities:
                endpoint = self.env['res.config.settings']._get_endpoint()
                params = {
                    'ocn_tokens': identities,
                    'data': self._ocn_prepare_payload(message, msg_vals)
                }
                jsonrpc(endpoint + '/iap/ocn/send', params=params)

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

        if not payload['model']:
            result = self._extract_model_and_id(msg_vals)
            if result:
                payload['model'] = result['model']
                payload['res_id'] = result['res_id']

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

        # Check payload limit of 4000 bytes (4kb) and if remain space add the body
        payload_length = len(str(payload).encode('utf-8'))
        if payload_length < 4000:
            body = msg_vals.get('body') if msg_vals else message.body
            # FIXME: when msg_type is 'user_notification', the type value of msg_vals.get('body') is bytes
            if type(body) == bytes:
                body = body.decode("utf-8")
            body = re.sub(r'<a(.*?)>', r'<a>', body)  # To-Do : Replace this fix
            body += self._generate_tracking_message(message, '<br/>')
            payload['body'] = html2text(body)[:4000 - payload_length]
        return payload

    @api.model
    def _extract_model_and_id(self, msg_vals):
        """
        Return the model and the id when is present in a link (HTML)
        :param msg_vals: the string where the regex will be applied
        :return: a dict empty if no matches and a dict with these keys if match : model and res_id
        """
        regex = r"<a.+model=(?P<model>[\w.]+).+res_id=(?P<id>\d+).+>[\s\w\/\\.]+<\/a>"
        matches = re.finditer(regex, msg_vals.get('body'))

        for match in matches:
            return {
                'model': match.group('model'),
                'res_id': match.group('id'),
            }
        return {}

    @api.model
    def _generate_tracking_message(self, message, return_line='\n'):
        '''
        Format the tracking values like in the chatter
        :param message: current mail.message record
        :param return_line: type of return line
        :return: a string with the new text if there is one or more tracking value
        '''
        tracking_message = ''
        if message.subtype_id:
            tracking_message = _(message.subtype_id.description) + return_line

        for value in message.sudo().tracking_value_ids:
            if value.field_type == 'boolean':
                old_value = str(bool(value.old_value_integer))
                new_value = str(bool(value.new_value_integer))
            else:
                old_value = _(value.old_value_char) if value.old_value_char else str(value.old_value_integer)
                new_value = _(value.new_value_char) if value.new_value_char else str(value.new_value_integer)

            tracking_message += _(value.field_desc) + ': ' + old_value
            if old_value != new_value:
                tracking_message += ' → ' + new_value
            tracking_message += return_line

        return tracking_message
