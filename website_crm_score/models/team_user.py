# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime

from odoo import fields, api, models
from odoo.tools.safe_eval import safe_eval

evaluation_context = {
    'datetime': datetime,
    'context_today': datetime.datetime.now,
}


class team_user(models.Model):
    _name = 'team.user'
    _inherit = ['mail.thread']
    _description = 'Salesperson (Team Member)'

    team_id = fields.Many2one('crm.team', string='Sales Team', required=True)
    user_id = fields.Many2one('res.users', string='Saleman', required=True)
    name = fields.Char(string="Name", related='user_id.partner_id.display_name', readonly=False)
    active = fields.Boolean(string='Running', default=True)
    team_user_domain = fields.Char('Domain', tracking=True)
    maximum_user_leads = fields.Integer('Leads Per Month')
    leads_count = fields.Integer('Assigned Leads', compute='_count_leads', help='Assigned Leads this last month')
    percentage_leads = fields.Float(compute='_get_percentage', string='Percentage leads')

    def _count_leads(self):
        for rec in self:
            if rec.id:
                limit_date = datetime.datetime.now() - datetime.timedelta(days=30)
                domain = [('user_id', '=', rec.user_id.id),
                          ('team_id', '=', rec.team_id.id),
                          ('date_open', '>', fields.Datetime.to_string(limit_date))
                          ]
                rec.leads_count = self.env['crm.lead'].search_count(domain)
            else:
                rec.leads_count = 0

    def _get_percentage(self):
        for rec in self:
            try:
                rec.percentage_leads = round(100 * rec.leads_count / float(rec.maximum_user_leads), 2)
            except ZeroDivisionError:
                rec.percentage_leads = 0.0

    @api.constrains('team_user_domain')
    def _assert_valid_domain(self):
        for rec in self:
            try:
                domain = safe_eval(rec.team_user_domain or '[]', evaluation_context)
                self.env['crm.lead'].search(domain, limit=1)
            except Exception:
                raise Warning('The domain is incorrectly formatted')
