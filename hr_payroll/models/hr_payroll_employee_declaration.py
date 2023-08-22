# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import logging

from collections import defaultdict

from odoo import models, fields, api, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class HrPayrollEmployeeDeclaration(models.Model):
    _name = 'hr.payroll.employee.declaration'
    _description = 'Payroll Employee Declaration'

    res_model = fields.Char(
        'Declaration Model Name', required=True, index=True)
    res_id = fields.Many2oneReference(
        'Declaration Model Id', index=True, model_field='res_model')
    employee_id = fields.Many2one('hr.employee')
    company_id = fields.Many2one('res.company', default=lambda self: self.env.company, required=True)
    pdf_file = fields.Binary('PDF File', readonly=True, attachment=False)
    pdf_filename = fields.Char()
    pdf_to_generate = fields.Boolean()

    def _generate_pdf(self):
        report_sudo = self.env["ir.actions.report"].sudo()
        declarations_by_sheet = defaultdict(lambda: self.env['hr.payroll.employee.declaration'])
        for declaration in self:
            declarations_by_sheet[(declaration.res_model, declaration.res_id)] += declaration


        for (res_model, res_id), declarations in declarations_by_sheet.items():
            sheet = self.env[res_model].browse(res_id)
            report_id = sheet._get_pdf_report().id
            rendering_data = sheet._get_rendering_data(declarations.employee_id)
            rendering_data = sheet._post_process_rendering_data_pdf(rendering_data)

            pdf_files = []
            sheet_count = len(rendering_data)
            counter = 1
            for employee, employee_data in rendering_data.items():
                _logger.info('Printing %s (%s/%s)', sheet._description, counter, sheet_count)
                counter += 1
                sheet_filename = sheet._get_pdf_filename(employee)
                sheet_file, dummy = report_sudo.with_context(lang=employee.lang)._render_qweb_pdf(
                    report_id,
                    [employee.id], data={'report_data': employee_data, 'employee': employee})
                pdf_files.append((employee, sheet_filename, sheet_file))
            if pdf_files:
                sheet._process_files(pdf_files)