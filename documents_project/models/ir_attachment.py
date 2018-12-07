# -*- coding: utf-8 -*-
from odoo import models, fields, api, exceptions


class IrAttachment(models.Model):
    _name = 'ir.attachment'
    _inherit = 'ir.attachment'

    def _create_document(self, vals):
        """
        :param vals: the create/write dictionary of ir attachment
        """
        document_ids = super(IrAttachment, self)._create_document(vals)

        if vals.get('res_model') in {'project.project', 'project.task'} and vals.get('res_id'):
            project = self.env[vals['res_model']].browse(vals['res_id'])
            company = project.company_id or self.env.user.company_id
            if company.exists() and company.documents_project_settings and company.project_folder:
                for record in self:
                    document_dict = {'attachment_id': record.id,
                                     'name': vals.get('name', record.name),
                                     'folder_id': company.project_folder.id,
                                     'tag_ids': [(6, 0, company.project_tags.ids if company.project_tags else [])],
                                     }
                    self.env['documents.document'].create(document_dict)
                return True
        return document_ids
