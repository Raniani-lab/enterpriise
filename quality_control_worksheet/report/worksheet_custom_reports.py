# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class QualityCustomReport(models.AbstractModel):
    _name = 'report.quality_control_worksheet.worksheet_custom'
    _description = 'Quality Worksheet Custom Report'

    @api.model
    def _get_report_values(self, docids, data=None):
        docs = self.env['quality.check'].browse(docids).sudo()

        worksheet_map = {}
        for check in docs:
            if check.worksheet_template_id:
                x_model = check.worksheet_template_id.model_id.model
                worksheet = self.env[x_model].search([('x_quality_check_id', '=', check.id)], limit=1, order="create_date DESC")  # take the last one
                worksheet_map[check.id] = worksheet

        return {
            'doc_ids': docids,
            'doc_model': 'quality.check',
            'docs': docs,
            'worksheet_map': worksheet_map,
        }
