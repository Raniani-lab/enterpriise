# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class ProjectCollaborator(models.Model):
    _inherit = 'project.collaborator'

    @api.model
    def _toggle_project_sharing_portal_rules(self, active):
        super()._toggle_project_sharing_portal_rules(active)
        access_worksheet_template_portal = self.env.ref('industry_fsm_report.access_project_worksheet_template_portal').sudo()
        if access_worksheet_template_portal.active != active:
            access_worksheet_template_portal.write({'active': active})
        worksheet_template_portal_rule = self.env.ref('industry_fsm_report.ir_rule_worksheet_template_project_portal').sudo()
        if worksheet_template_portal_rule.active != active:
            worksheet_template_portal_rule.write({'active': active})
