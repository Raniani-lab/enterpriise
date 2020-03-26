# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Lead(models.Model):
    _inherit = 'crm.lead'

    score = fields.Float(string='Score', compute='_compute_score', store=True, group_operator="avg")
    score_ids = fields.Many2many('website.crm.score', 'crm_lead_score_rel', 'lead_id', 'score_id', string='Scoring Rules')

    @api.depends('score_ids', 'score_ids.value')
    def _compute_score(self):
        self._cr.execute("""
             SELECT
                lead_id, COALESCE(sum(s.value), 0) as sum
             FROM
                crm_lead_score_rel rel
             LEFT JOIN
                website_crm_score s ON (s.id = rel.score_id)
             WHERE lead_id = any(%s)
             GROUP BY lead_id
             """, (self.ids,))
        scores = dict(self._cr.fetchall())
        for lead in self:
            lead.score = scores.get(lead.id, 0)

    def _merge_scores(self, opportunities):
        # We needs to delete score from opportunity_id, to be sure that all rules will be re-evaluated.
        self.sudo().write({'score_ids': [(6, 0, [])]})
        if not self.env.context.get('assign_leads_to_salesteams'):
            self.env['website.crm.score'].assign_scores_to_leads(lead_ids=self.ids)

    def _merge_dependences(self, opportunities):
        self._merge_scores(opportunities)

        # Call default merge function
        return super(Lead, self)._merge_dependences(opportunities)
