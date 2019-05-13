# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    def open_followup_level_form(self):
        followup_line_ids = self.env['account_followup.followup.line'].search([('company_id', '=', self.env.company.id)])
        return {
                 'type': 'ir.actions.act_window',
                 'name': 'Payment Follow-ups Levels',
                 'res_model': 'account_followup.followup.line',
                 'domain': [('id', 'in', followup_line_ids.ids)],
                 'view_mode': 'tree,form',
         }
