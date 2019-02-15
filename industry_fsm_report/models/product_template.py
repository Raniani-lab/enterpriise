# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ProductTemplate(models.Model):
    _inherit = "product.template"

    report_template_id = fields.Many2one('project.report.template', string="Report Template")

    @api.onchange('service_tracking')
    def _onchange_service_tracking(self):
        if self.service_tracking not in ['task_global_project', 'task_new_project']:
            self.report_template_id = False
