# -*- coding: utf-8 -*-

from odoo import models


class IrAttachment(models.Model):
    _inherit = 'ir.attachment'

    def _create_document(self, vals):
        """
        :param vals: the create/write dictionary of ir attachment
        """
        has_created_documents = super(IrAttachment, self)._create_document(vals)

        res_id = vals.get('res_id')
        res_model = vals.get('res_model')
        if res_model in {'hr.applicant', 'hr.job'} and res_id:
            applicant = self.env[res_model].browse(res_id)
            company = applicant.company_id

            if company.exists() and company.documents_recruitment_settings and company.recruitment_folder_id:
                document_vals_list = [{
                    'attachment_id': record.id,
                    'name': vals.get('name', record.name),
                    'folder_id': company.recruitment_folder_id.id,
                    'tag_ids': [(6, 0, company.recruitment_tag_ids.ids)] if res_model == 'hr.applicant' else []
                } for record in self]

                if document_vals_list:
                    self.env['documents.document'].create(document_vals_list)
                    return True

        return has_created_documents
