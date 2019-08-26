# -*- coding: utf-8 -*-

from odoo import models


class IrAttachment(models.Model):
    _name = 'ir.attachment'
    _inherit = 'ir.attachment'

    def _create_document(self, vals):
        """
        :param vals: the create/write dictionary of ir attachment
        """
        document_ids = super(IrAttachment, self)._create_document(vals)
        res_model = vals.get('res_model')
        # YTI TODO: Make something modular with that brol
        res_models = {
            'hr.employee': lambda rec: rec.user_id,
            'hr.contract': lambda rec: rec.employee_id.user_id,
            'hr.leave': lambda rec: rec.user_id,
            'hr.payslip': lambda rec: rec.employee_id.user_id,
        }
        if res_model in res_models and vals.get('res_id'):
            hr_record = self.env[res_model].browse(vals['res_id'])
            company = hr_record.company_id if hasattr(hr_record, 'company_id') else False
            company = company or self.env.company
            owner = res_models[res_model](hr_record) or False
            if company.exists() and company.documents_hr_settings and company.documents_hr_folder:
                for record in self:
                    document_dict = {
                        'attachment_id': record.id,
                        'name': vals.get('name', record.name),
                        'folder_id': company.documents_hr_folder.id,
                     }
                    if owner:
                        document_dict['owner_id'] = owner.id
                    if res_model == 'hr.contract':
                        document_dict['tag_ids'] = [(6, 0, company.documents_hr_contracts_tags.ids)]
                    elif res_model == 'hr.payslip':
                        document_dict['tag_ids'] = [(6, 0, company.documents_hr_payslips_tags.ids)]
                    self.env['documents.document'].create(document_dict)
                return True
        return document_ids
