# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging as logger
import re
import json
from requests import Session

from odoo import api, models, tools
from ..web_push import push_to_end_point, DeviceUnreachableError

MAX_DIRECT_PUSH = 5

_logger = logger.getLogger(__name__)


class MailThread(models.AbstractModel):
    _inherit = 'mail.thread'

    def _notify_thread(self, message, msg_vals=False, **kwargs):
        recipients_data = super()._notify_thread(message, msg_vals=msg_vals, **kwargs)
        self._notify_thread_by_web_push(message, recipients_data, msg_vals, **kwargs)
        return recipients_data

    def _extract_partner_ids_for_notifications(self, message, msg_vals, recipients_data):
        notif_pids = []
        no_inbox_pids = []
        for recipient in recipients_data:
            if recipient['active']:
                notif_pids.append(recipient['id'])
                if recipient['notif'] != 'inbox':
                    no_inbox_pids.append(recipient['id'])

        if not notif_pids:
            return []

        msg_sudo = message.sudo()
        msg_type = msg_vals.get('message_type') or msg_sudo.message_type
        author_id = [msg_vals.get('author_id')] if 'author_id' in msg_vals else msg_sudo.author_id.ids
        # never send to author and to people outside Odoo (email), except comments
        pids = set()
        if msg_type == 'comment':
            pids = set(notif_pids) - set(author_id)
        elif msg_type in ('notification', 'user_notification', 'email'):
            pids = (set(notif_pids) - set(author_id) - set(no_inbox_pids))
        return list(pids)

    def _truncate_payload(self, payload):
        """
        Check the payload limit of 4096 bytes to avoid 413 error return code.
        If the payload is too big, we trunc the body value.
        :param dict payload: Current payload to trunc
        :return: The truncate payload;
        """
        payload_length = len(str(payload).encode())
        body = payload['options']['body']
        body_length = len(body)
        if payload_length > 4096:
            body_max_length = 4096 - payload_length - body_length
            payload['options']['body'] = body.encode()[:body_max_length].decode(errors="ignore")
        return payload

    def _notify_thread_by_web_push(self, message, recipients_data, msg_vals=False, **kwargs):
        """ Method to send cloud notifications for every mention of a partner
        and every direct message. We have to take into account the risk of
        duplicated notifications in case of a mention in a channel of `chat` type.

        :param message: ``mail.message`` record to notify;
        :param recipients_data: list of recipients information (based on res.partner
          records), formatted like
            [{'active': partner.active;
              'id': id of the res.partner being recipient to notify;
              'groups': res.group IDs if linked to a user;
              'notif': 'inbox', 'email', 'sms' (SMS App);
              'share': partner.partner_share;
              'type': 'customer', 'portal', 'user;'
             }, {...}].
          See ``MailThread._notify_get_recipients``;
        :param msg_vals: dictionary of values used to create the message. If given it
          may be used to access values related to ``message`` without accessing it
          directly. It lessens query count in some optimized use cases by avoiding
          access message content in db;
        """

        msg_vals = dict(msg_vals or {})
        partner_ids = self._extract_partner_ids_for_notifications(message, msg_vals, recipients_data)
        if not partner_ids:
            return

        partner_devices_sudo = self.env['mail.partner.device'].sudo()
        devices = partner_devices_sudo.search([
            ('partner_id', 'in', partner_ids)
        ])
        if not devices:
            return

        ir_parameter_sudo = self.env['ir.config_parameter'].sudo()
        vapid_private_key = ir_parameter_sudo.get_param('mail_enterprise.web_push_vapid_private_key')
        vapid_public_key = ir_parameter_sudo.get_param('mail_enterprise.web_push_vapid_public_key')
        if not vapid_private_key or not vapid_public_key:
            logger.warning("Missing web push vapid keys !")
            return

        payload = self._notify_by_web_push_prepare_payload(message, msg_vals=msg_vals)
        payload = self._truncate_payload(payload)
        if len(devices) < MAX_DIRECT_PUSH:
            session = Session()
            devices_to_unlink = set()
            for device in devices:
                try:
                    push_to_end_point(
                        base_url=self.get_base_url(),
                        device={
                            'id': device.id,
                            'endpoint': device.endpoint,
                            'keys': device.keys
                        },
                        payload=json.dumps(payload),
                        vapid_private_key=vapid_private_key,
                        vapid_public_key=vapid_public_key,
                        session=session,
                    )
                except DeviceUnreachableError:
                    devices_to_unlink.add(device.id)
                except Exception as e:
                    # Avoid blocking the whole request just for a notification
                    _logger.error('An error occurred while contacting the endpoint: %s', e)

            # clean up obsolete devices
            if devices_to_unlink:
                devices_list = list(devices_to_unlink)
                self.env['mail.partner.device'].sudo().browse(devices_list).unlink()

        else:
            self.env['mail.notification.web.push'].sudo().create([{
                'user_device': device.id,
                'payload': json.dumps(payload),
            } for device in devices])
            self.env.ref('mail_enterprise.ir_cron_web_push_notification')._trigger()

    def _notify_by_web_push_prepare_payload(self, message, msg_vals=False):
        """ Returns dictionary containing message information for a browser device.
        This info will be delivered to a browser device via its recorded endpoint.
        REM: It is having a limit of 4000 bytes (4kb)
        """
        if msg_vals:
            author_id = [msg_vals.get('author_id')]
            author_name = self.env['res.partner'].browse(author_id).name
            model = msg_vals.get('model')
            title = msg_vals.get('record_name') or msg_vals.get('subject')
            res_id = msg_vals.get('res_id')
            body = msg_vals.get('body')
            if not model and body:
                model, res_id = self._extract_model_and_id(msg_vals)
        else:
            author_id = [message.author_id.ids]
            author_name = self.env['res.partner'].browse(author_id).name
            model = message.model
            title = message.record_name or message.subject
            res_id = message.res_id
            body = message.body

        icon = '/web_enterprise/static/img/odoo-icon-192x192.png'

        if author_name:
            title = "%s: %s" % (author_name, title)
            icon = "/web/image/res.users/%d/avatar_128" % author_id[0]

        payload = {
            'title': title,
            'options': {
                'icon': icon,
                'data': {
                    'model': model if model else '',
                    'res_id': res_id if res_id else '',
                }
            }
        }
        payload['options']['body'] = tools.html2plaintext(body)
        payload['options']['body'] += self._generate_tracking_message(message)

        return payload

    @api.model
    def _extract_model_and_id(self, msg_vals):
        """
        Return the model and the id when is present in a link (HTML)

        :param msg_vals: see :meth:`._notify_thread_by_web_push`

        :return: a dict empty if no matches and a dict with these keys if match : model and res_id
        """
        regex = r"<a.+model=(?P<model>[\w.]+).+res_id=(?P<id>\d+).+>[\s\w\/\\.]+<\/a>"
        matches = re.finditer(regex, msg_vals['body'])

        for match in matches:
            return match['model'], match['id']
        return None, None

    @api.model
    def _generate_tracking_message(self, message, return_line='\n'):
        """
        Format the tracking values like in the chatter
        :param message: current mail.message record
        :param return_line: type of return line
        :return: a string with the new text if there is one or more tracking value
        """
        tracking_message = ''
        if message.subtype_id and message.subtype_id.description:
            tracking_message = return_line + message.subtype_id.description + return_line

        for value in message.sudo().tracking_value_ids.filtered(lambda tracking: not tracking.field_groups):
            if value.field_type == 'boolean':
                old_value = str(bool(value.old_value_integer))
                new_value = str(bool(value.new_value_integer))
            else:
                old_value = value.old_value_char if value.old_value_char else str(value.old_value_integer)
                new_value = value.new_value_char if value.new_value_char else str(value.new_value_integer)

            tracking_message += value.field_desc + ': ' + old_value
            if old_value != new_value:
                tracking_message += ' → ' + new_value
            tracking_message += return_line

        return tracking_message
