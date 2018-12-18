# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class SurveyUserInput(models.Model):
    _inherit = "survey.user_input"

    appraisal_id = fields.Many2one('hr.appraisal', string='Appraisal')

    @api.multi
    def action_resend(self):
        appraisals = self.mapped('appraisal_id')
        if appraisals and len(appraisals) == 1:
            self = self.with_context(
                default_deadline=appraisals.date_close,
                default_appraisal_id=appraisals.id)
        return super(SurveyUserInput, self).action_resend()
