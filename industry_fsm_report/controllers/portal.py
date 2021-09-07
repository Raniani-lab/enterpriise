# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request
from odoo.addons.portal.controllers import portal
from odoo.addons.project.controllers.portal import ProjectCustomerPortal


class CustomerPortal(portal.CustomerPortal):

    def _get_worksheet_data(self, task_sudo):
        data = super(CustomerPortal, self)._get_worksheet_data(task_sudo)
        worksheet_map = {}
        if task_sudo.worksheet_template_id:
            x_model = task_sudo.worksheet_template_id.model_id.model
            worksheet = request.env[x_model].sudo().search([('x_project_task_id', '=', task_sudo.id)], limit=1, order="create_date DESC")  # take the last one
            worksheet_map[task_sudo.id] = worksheet
        data.update({'worksheet_map': worksheet_map})
        return data

class TimesheetProjectCustomerPortal(ProjectCustomerPortal):

    def _show_task_report(self, task_sudo, report_type, download):
        if not task_sudo.is_fsm:
            return super()._show_task_report(task_sudo, report_type, download)
        return self._show_report(model=task_sudo,
            report_type=report_type, report_ref='industry_fsm_report.task_custom_report', download=download)
