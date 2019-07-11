# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api


class IrModelFields(models.Model):
    _inherit = 'ir.model.fields'

    @api.model
    def create(self, values):
        result = super(IrModelFields, self).create(values)
        self._trigger_project_worksheet_report_regeneration(result.mapped('model_id').ids)
        return result

    def write(self, values):
        result = super(IrModelFields, self).write(values)
        self._trigger_project_worksheet_report_regeneration(self.mapped('model_id').ids)
        return result

    def unlink(self):
        model_ids = self.mapped('model_id').ids
        result = super(IrModelFields, self).unlink()
        self._trigger_project_worksheet_report_regeneration(model_ids)
        return result

    @api.model
    def _trigger_project_worksheet_report_regeneration(self, model_ids):
        worksheet_template_to_change = self.env['project.worksheet.template'].sudo().search([('model_id', 'in', model_ids)])
        if worksheet_template_to_change:
            worksheet_template_to_change._generate_qweb_report_template()
