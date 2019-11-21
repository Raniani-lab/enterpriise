# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class TaskCustomReport(models.AbstractModel):
    _inherit = 'report.industry_fsm_report.worksheet_custom'

    @api.model
    def _get_report_values(self, docids, data=None):
        tasks = self.env['project.task'].browse(docids).sudo()
        for task in tasks.filtered(lambda task: task.worksheet_template_id):
            task._reflect_timesheet_quantities()
        return super()._get_report_values(docids, data=data)
