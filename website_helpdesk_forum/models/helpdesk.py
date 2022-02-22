# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.addons.http_routing.models.ir_http import slug
from odoo.exceptions import UserError


class HelpdeskTeam(models.Model):
    _inherit = "helpdesk.team"

    def _ensure_help_center_is_activated(self):
        self.ensure_one()
        if not self.use_website_helpdesk_forum:
            raise UserError(_('Help Center not active for this team.'))
        return True

    @api.model
    def _get_knowledge_base_fields(self):
        return super()._get_knowledge_base_fields() + ['use_website_helpdesk_forum']

    def _helpcenter_filter_types(self):
        res = super()._helpcenter_filter_types()
        if not self.use_website_helpdesk_forum:
            return res

        res['forum_posts_only'] = _('Forum Posts')
        return res

    def _helpcenter_filter_tags(self):
        res = super()._helpcenter_filter_tags()
        if not self.use_website_helpdesk_forum:
            return res

        tags = self.env['forum.tag'].search([
            ('posts_count', '>', 0),
        ], order='posts_count desc', limit=20)
        return res + tags.mapped(lambda t: t.name and t.name.lower())

class HelpdeskTicket(models.Model):
    _inherit = "helpdesk.ticket"

    forum_post_ids = fields.Many2many('forum.post', string="Forum Posts", copy=False)
    forum_post_count = fields.Integer(compute='_compute_forum_post_count')
    use_website_helpdesk_forum = fields.Boolean(related='team_id.use_website_helpdesk_forum', string='Help Center Active', readonly=True)
    can_share_forum = fields.Boolean(compute='_compute_can_share_forum')

    @api.depends_context('uid')
    @api.depends('use_website_helpdesk_forum')
    def _compute_can_share_forum(self):
        forum_count = self.env['forum.forum'].search_count([])
        for ticket in self:
            ticket.can_share_forum = ticket.use_website_helpdesk_forum and forum_count

    @api.depends_context('uid')
    @api.depends('forum_post_ids')
    def _compute_forum_post_count(self):
        rg = self.env['forum.post']._read_group([('can_view', '=', True), ('id', 'in', self.forum_post_ids.ids)], ['ticket_id'], ['ticket_id'])
        posts_count = {r['ticket_id'][0]: r['ticket_id_count'] for r in rg}
        for ticket in self:
            ticket.forum_post_count = posts_count.get(ticket.id, 0)

    def action_share_ticket_on_forum(self):
        self.ensure_one()
        self.team_id._ensure_help_center_is_activated()
        return self.env['ir.actions.actions']._for_xml_id('website_helpdesk_forum.helpdesk_ticket_select_forum_wizard_action')

    def action_open_forum_posts(self, edit=False):
        self.ensure_one()
        self.team_id._ensure_help_center_is_activated()
        if not self.forum_post_ids:
            raise UserError(_('No posts associated to this ticket.'))

        if len(self.forum_post_ids) > 1:
            action = self.env['ir.actions.actions']._for_xml_id('website_forum.action_forum_posts')
            action['domain'] = [('id', 'in', self.forum_post_ids.ids)]
            return action

        return self.forum_post_ids.open_forum_post(edit)
