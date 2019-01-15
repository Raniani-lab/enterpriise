# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class SurveyInvite(models.TransientModel):
    _inherit = 'survey.invite'

    appraisal_id = fields.Many2one('hr.appraisal', string='Appraisal')

    def _get_answers_values(self):
        values = super(SurveyInvite, self)._get_answers_values()
        values['appraisal_id'] = self.appraisal_id.id
        return values
