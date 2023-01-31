# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class L10nBeIndividualAccount(models.Model):
    _inherit = 'l10n_be.individual.account'

    documents_enabled = fields.Boolean(compute='_compute_documents_enabled')
    documents_count = fields.Integer(compute='_compute_documents_count')

    def action_see_documents(self):
        documents = self.line_ids.mapped('pdf_filename')
        domain = [('name', 'in', documents)]
        return {
            'name': _('Documents'),
            'domain': domain,
            'res_model': 'documents.document',
            'type': 'ir.actions.act_window',
            'views': [(False, 'kanban'), (False, 'list'), (False, 'form')],
            'view_mode': 'tree,form',
            'context': {'searchpanel_default_folder_id': self.company_id.documents_payroll_folder_id.id}
        }

    @api.depends('line_ids')
    def _compute_documents_count(self):
        posted_documents = self.line_ids._get_posted_documents()
        grouped_data = self.env['l10n_be.individual.account.line']._read_group(domain=[('sheet_id', 'in', self.ids), ('pdf_filename', 'in', posted_documents)],
                                                                               groupby=['sheet_id'],
                                                                               aggregates=['__count'])
        mapped_data = dict(grouped_data)
        for sheet in self:
            sheet.documents_count = mapped_data.get(sheet, 0)

    @api.depends('company_id.documents_payroll_folder_id', 'company_id.documents_hr_settings')
    def _compute_documents_enabled(self):
        for sheet in self:
            sheet.documents_enabled = sheet.company_id._payroll_documents_enabled()

    def action_post_in_documents(self):
        self.ensure_one()
        if not self.company_id._payroll_documents_enabled():
            return
        self.line_ids.write({'pdf_to_post': True})
        self.env.ref('hr_payroll.ir_cron_generate_payslip_pdfs')._trigger()

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'type': 'success',
                'message': _("PDFs posted in Documents"),
            }
        }

class L10nBeIndividualAccountLine(models.Model):
    _inherit = 'l10n_be.individual.account.line'

    pdf_to_post = fields.Boolean()

    def _get_posted_documents(self):
        document_data = self.env['documents.document']._read_group([
            ('name', 'in', [line.pdf_filename for line in self]), ('active', '=', True)],
            groupby=['name'], aggregates=['__count'])
        mapped_data = dict(document_data)
        return [posted_filename for posted_filename in mapped_data if mapped_data[posted_filename] > 0]

    def _post_pdf(self):
        template = self.env.ref('documents_l10n_be_hr_payroll.mail_template_individual_account', raise_if_not_found=False)
        create_vals = []
        posted_documents = self._get_posted_documents()
        for line in self:
            if line.pdf_filename not in posted_documents and line.pdf_file:
                create_vals.append({
                    'owner_id': line.employee_id.user_id.id,
                    'datas': line.pdf_file,
                    'name': line.pdf_filename,
                    'folder_id': line.sheet_id.company_id.documents_payroll_folder_id.id,
                    'res_model': 'hr.payslip',  # Security Restriction to payroll managers
                })
                if template:
                    template.send_mail(line.employee_id.id, email_layout_xmlid='mail.mail_notification_light')

        self.env['documents.document'].create(create_vals)
