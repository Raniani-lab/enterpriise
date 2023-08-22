# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _


class HrPayrollEmployeeDeclaration(models.Model):
    _inherit = 'hr.payroll.employee.declaration'

    pdf_to_post = fields.Boolean()

    def _get_posted_documents(self):
        document_data = self.env['documents.document']._read_group([
            ('name', 'in', [line.pdf_filename for line in self]), ('active', '=', True)],
            groupby=['name'], aggregates=['__count'])
        mapped_data = dict(document_data)
        return [posted_filename for posted_filename in mapped_data if mapped_data[posted_filename] > 0]

    def _post_pdf(self):
        create_vals = []
        posted_documents = self._get_posted_documents()
        for line in self:
            template = self.env[line.res_model]._get_posted_mail_template()
            if line.pdf_filename not in posted_documents and line.pdf_file:
                create_vals.append({
                    'owner_id': line.employee_id.user_id.id,
                    'datas': line.pdf_file,
                    'name': line.pdf_filename,
                    'folder_id': line.company_id.documents_payroll_folder_id.id,
                    'res_model': 'hr.payslip',  # Security Restriction to payroll managers
                })
                if template:
                    template.send_mail(line.employee_id.id, email_layout_xmlid='mail.mail_notification_light')

        self.env['documents.document'].create(create_vals)
