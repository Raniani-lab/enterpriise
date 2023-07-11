# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ProjectProject(models.Model):
    _inherit = "project.project"

    worksheet_template_id = fields.Many2one(
        'worksheet.template', compute="_compute_worksheet_template_id", store=True, readonly=False,
        string="Default Worksheet",
        domain="[('res_model', '=', 'project.task'), '|', ('company_ids', '=', False), ('company_ids', 'in', company_id)]")

    @api.depends('allow_worksheets')
    def _compute_worksheet_template_id(self):
        default_worksheet = self.env.ref('industry_fsm_report.fsm_worksheet_template', False)
        for project in self:
            if not project.worksheet_template_id:
                if project.allow_worksheets and default_worksheet:
                    project.worksheet_template_id = default_worksheet.id
                else:
                    project.worksheet_template_id = False
