# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from datetime import timedelta

from odoo import api, fields, models, _

_logger = logging.getLogger(__name__)


class Job(models.Model):
    _inherit = "hr.job"
    _order = 'job_open_date'
    _inherits = {'utm.campaign': 'utm_campaign_id'}

    job_open_date = fields.Date('Job Start Recruitment Date', default=fields.Date.today())
    utm_campaign_id = fields.Many2one('utm.campaign', 'Campaign', ondelete='cascade', required=True)
    max_points = fields.Integer(compute='_compute_max_points')
    direct_clicks = fields.Integer(compute='_compute_clicks')
    facebook_clicks = fields.Integer(compute='_compute_clicks')
    twitter_clicks = fields.Integer(compute='_compute_clicks')
    linkedin_clicks = fields.Integer(compute='_compute_clicks')

    def _compute_clicks(self):
        grouped_data = self.env['link.tracker'].read_group([
            ('source_id', '=', self.env.user.employee_id.utm_source_id.id),
            ('campaign_id', 'in', self.mapped('utm_campaign_id').ids)
            ], ['count', 'campaign_id', 'medium_id'], ['campaign_id', 'medium_id'], lazy=False)
        medium_direct = self.env.ref('utm.utm_medium_direct')
        medium_facebook = self.env.ref('utm.utm_medium_facebook')
        medium_twitter = self.env.ref('utm.utm_medium_twitter')
        medium_linkedin = self.env.ref('utm.utm_medium_linkedin')
        mapped_data = {job.utm_campaign_id.id: {} for job in self}
        for elem in grouped_data:
            mapped_data[elem['campaign_id'][0]][elem['medium_id'][0]] = elem['count']
        for job in self:
            data = mapped_data[job.utm_campaign_id.id]
            job.direct_clicks = data.get(medium_direct.id, 0)
            job.facebook_clicks = data.get(medium_facebook.id, 0)
            job.twitter_clicks = data.get(medium_twitter.id, 0)
            job.linkedin_clicks = data.get(medium_linkedin.id, 0)

    def _compute_max_points(self):
        for job in self:
            stages = self.env['hr.recruitment.stage'].search(['|', ('job_ids', '=', False), ('job_ids', '=', job.id)])
            job.max_points = sum(stages.mapped('points'))

    def _init_column(self, column_name):
        """ Create utm.campaign for already existing records """
        if column_name == "utm_campaign_id":
            _logger.debug("Table '%s': setting default value of new column %s to unique campaign for each row", self._table, column_name)
            self.env.cr.execute("SELECT id,name FROM %s WHERE utm_campaign_id IS NULL" % self._table)
            job_ids = self.env.cr.dictfetchall()
            query_list = [{'id': j['id'], 'utm_campaign_id': self.env['utm.campaign'].create({'name': j['name']}).id} for j in job_ids]
            query = 'UPDATE ' + self._table + ' SET utm_campaign_id = %(utm_campaign_id)s WHERE id = %(id)s;'
            self.env.cr._obj.executemany(query, query_list)
            self.env.cr.commit()
        else:
            super()._init_column(column_name)

    @api.model
    def create(self, vals):
        utm = self.env['utm.campaign'].sudo().create({'name': vals['name']})
        vals['utm_campaign_id'] = utm.id
        return super().create(vals)

    def set_recruit(self):
        self.job_open_date.write({'job_open_date': fields.Date.today()})
        return super(Job, self).set_recruit()

    def action_share_external(self):
        self.ensure_one()
        wizard = self.env['hr.referral.link.to.share'].create({'job_id': self.id})
        return {
            'name': _("Visit Webpage"),
            'type': 'ir.actions.act_url',
            'url': wizard.url,
            'target': 'new',
        }
