# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from lxml import etree

from odoo import api, fields, models
from odoo.addons.http_routing.models.ir_http import slug


class HelpdeskTeam(models.Model):
    _name = "helpdesk.team"
    _inherit = ['helpdesk.team', 'website.published.mixin']

    feature_form_url = fields.Char('URL to Submit Issue', readonly=True, compute='_compute_form_url')
    website_form_view_id = fields.Many2one('ir.ui.view', string="Form")

    def _compute_website_url(self):
        super(HelpdeskTeam, self)._compute_website_url()
        for team in self:
            team.website_url = "/helpdesk/%s" % slug(team)

    @api.onchange('use_website_helpdesk_form', 'use_website_helpdesk_forum', 'use_website_helpdesk_slides')
    def _onchange_use_website_helpdesk(self):
        if not (self.use_website_helpdesk_form or self.use_website_helpdesk_forum or self.use_website_helpdesk_slides) and self.website_published:
            self.is_published = False
        elif self.use_website_helpdesk_form and not self.website_published:
            self.is_published = True

    def write(self, vals):
        if 'active' in vals and not vals['active']:
            vals['is_published'] = False
        if 'use_website_helpdesk_form' in vals and vals['use_website_helpdesk_form']:
            self._ensure_submit_form_view()
        return super(HelpdeskTeam, self).write(vals)

    def action_view_all_rating(self):
        """ Override this method without calling parent to redirect to rating website team page """
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'name': "Redirect to the Website Helpdesk Rating Page",
            'target': 'self',
            'url': "/helpdesk/rating/"
        }

    @api.model_create_multi
    def create(self, vals_list):
        teams = super(HelpdeskTeam, self).create(vals_list)
        teams.filtered('use_website_helpdesk_form')._ensure_submit_form_view()
        return teams

    def unlink(self):
        teams_with_submit_form = self.filtered(lambda t: t.website_form_view_id is not False)
        for team in teams_with_submit_form:
            team.website_form_view_id.unlink()
        return super(HelpdeskTeam, self).unlink()

    def _ensure_submit_form_view(self):
        for team in self:
            if not team.website_form_view_id:
                default_form = etree.fromstring(self.env.ref('website_helpdesk.ticket_submit_form').arch)
                xmlid = 'website_helpdesk.team_form_' + str(team.id)
                form_template = self.env['ir.ui.view'].create({
                    'type': 'qweb',
                    'arch': etree.tostring(default_form),
                    'name': xmlid,
                    'key': xmlid
                })
                self.env['ir.model.data'].create({
                    'module': 'website_helpdesk',
                    'name': xmlid.split('.')[1],
                    'model': 'ir.ui.view',
                    'res_id': form_template.id,
                    'noupdate': True
                })

                team.write({'website_form_view_id': form_template.id})

    @api.depends('name', 'use_website_helpdesk_form', 'company_id')
    def _compute_form_url(self):
        for team in self:
            base_url = team.get_base_url()
            team.feature_form_url = (team.use_website_helpdesk_form and team.name and team.id) and (base_url + '/helpdesk/' + slug(team)) or False
