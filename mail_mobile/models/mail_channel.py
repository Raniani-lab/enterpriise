# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class MailChannel(models.Model):
    _inherit = 'mail.channel'

    def _notify_record_by_ocn(self, message, rdata, msg_vals=False, **kwargs):
        """ Specifically handle channel members. """
        icp_sudo = self.env['ir.config_parameter'].sudo()
        # Avoid to send notification if this feature is disabled or if no user use the mobile app.
        if not icp_sudo.get_param('odoo_ocn.project_id') or not icp_sudo.get_param('mail_mobile.enable_ocn'):
            return

        notif_pids = []
        no_inbox_pids = []
        for r in rdata['partners']:
            if r['active']:
                notif_pids.append(r['id'])
                if r['notif'] != 'inbox':
                    no_inbox_pids.append(r['id'])

        chat_channels = self.filtered(lambda channel: channel.channel_type == 'chat')
        if not notif_pids and not chat_channels:
            return

        msg_sudo = message.sudo()  # why sudo?
        msg_type = msg_vals.get('message_type') or msg_sudo.message_type
        author_id = [msg_vals.get('author_id')] if 'author_id' in msg_vals else message.author_id.ids

        if msg_type == 'comment':
            if chat_channels:
                channel_partner_ids = chat_channels.mapped("channel_partner_ids").ids
            else:
                channel_partner_ids = []
            pids = (set(notif_pids) | set(channel_partner_ids)) - set(author_id)
            self._send_notification_to_partners(pids, message, msg_vals)
        elif msg_type in ('notification', 'user_notification', 'email'):
            # Send notification to partners except for the author and those who
            # do not want to handle notifications in Odoo.
            pids = (set(notif_pids) - set(author_id) - set(no_inbox_pids))
            self._send_notification_to_partners(pids, message, msg_vals)
