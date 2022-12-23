# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re

from odoo import api, fields, models, _
from odoo.tools import html_escape, is_html_empty, plaintext2html


class HelpdeskTeam(models.Model):
    _inherit = ['helpdesk.team']

    feature_livechat_channel_id = fields.Many2one('im_livechat.channel', string='Live Chat Channel', compute='_get_livechat_channel', store=True)

    @api.depends('use_website_helpdesk_livechat')
    def _get_livechat_channel(self):
        LiveChat = self.env['im_livechat.channel']
        for team in self:
            if team.name and team.use_website_helpdesk_livechat:
                channel = LiveChat.search([('name', '=', team.name)], limit=1)
                if not channel:
                    if team.member_ids:
                        channel = LiveChat.create({'name': team.name, 'user_ids': [(6, _, team.member_ids.ids)]})
                    else:
                        channel = LiveChat.create({'name': team.name})
                team.feature_livechat_channel_id = channel
            else:
                team.feature_livechat_channel_id = False


class MailChannel(models.Model):
    _inherit = 'mail.channel'

    # ------------------------------------------------------
    #  Commands
    # ------------------------------------------------------

    def execute_command_helpdesk(self, **kwargs):
        key = kwargs.get('body').split()
        msg = _('Something is missing or wrong in command')
        partners = self.with_context(active_test=False).channel_partner_ids.filtered(lambda partner: partner != self.env.user.partner_id)
        if key[0].lower() == '/ticket':
            if len(key) == 1:
                msg = _("""
                    Create a new helpdesk ticket by typing <b>/ticket <i>ticket title</i></b><br>
                    """)
            else:
                customer = partners[:1]
                list_value = key[1:]
                description = ''
                odoobot = self.env.ref('base.partner_root')
                for message in self.message_ids.sorted(key=lambda r: r.id):
                    if is_html_empty(message.body) or message.author_id == odoobot:
                        continue
                    name = message.author_id.name or 'Anonymous'
                    description += '%s: ' % name + '%s\n' % re.sub('<[^>]*>', '', message.body)
                team = self.env['helpdesk.team'].search([('use_website_helpdesk_livechat', '=', True)], order='sequence', limit=1)
                team_id = team.id if team else False
                helpdesk_ticket = self.env['helpdesk.ticket'].with_context(with_partner=True).create({
                    'name': ' '.join(list_value),
                    'description': plaintext2html(description),
                    'partner_id': customer.id if customer else False,
                    'team_id': team_id,
                })
                msg = _("Created a new ticket: %s", helpdesk_ticket._get_html_link())
        return self._send_transient_message(self.env.user.partner_id, msg)

    def execute_command_helpdesk_search(self, **kwargs):
        key = kwargs.get('body').split()
        partner = self.env.user.partner_id
        msg = _('Something is missing or wrong in command')
        if key[0].lower() == '/search_tickets':
            if len(key) == 1:
                msg = _('Search helpdesk tickets by typing <b>/search_tickets <i>keyword</i></b>')
            else:
                list_value = key[1:]
                Keywords = re.findall('\w+', ' '.join(list_value))
                HelpdeskTag = self.env['helpdesk.tag']
                for Keyword in Keywords:
                    HelpdeskTag |= HelpdeskTag.search([('name', 'ilike', Keyword)])
                tickets = self.env['helpdesk.ticket'].search([('tag_ids', 'in', HelpdeskTag.ids)], limit=10)
                if not tickets:
                    for Keyword in Keywords:
                        tickets |= self.env['helpdesk.ticket'].search([
                            '|', '|', '|', '|', '|',
                            ('name', 'ilike', Keyword),
                            ('ticket_ref', 'ilike', Keyword),
                            ('partner_id.id', 'ilike', Keyword),
                            ('partner_name', 'ilike', Keyword),
                            ('partner_email', 'ilike', Keyword),
                            ('partner_phone', 'ilike', Keyword)
                        ], order="id desc", limit=10)
                        if len(tickets) > 10:
                            break
                if tickets:
                    link_tickets = [f'<br/>{ticket.with_context(with_partner=True)._get_html_link()}' for ticket in tickets]
                    msg = _('Tickets search results for <b>%s</b>: %s', ' '.join(list_value), ''.join(link_tickets))
                else:
                    msg = _('No tickets found for <b>%s</b>. <br> Make sure you are using the right format:<br> <b>/search_tickets <i>keyword</i></b>', ''.join(list_value))
        return self._send_transient_message(partner, msg)
