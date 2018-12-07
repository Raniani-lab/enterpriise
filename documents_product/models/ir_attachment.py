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

        if vals.get('res_model') in {'product.product', 'product.template'} and vals.get('res_id'):
            product = self.env[vals['res_model']].browse(vals['res_id'])
            company = product.company_id or self.env.user.company_id
            if company.exists() and company.documents_product_settings and company.product_folder:
                for record in self:
                    document_dict = {
                        'attachment_id': record.id,
                        'name': vals.get('name', record.name),
                        'folder_id': company.product_folder.id,
                        'tag_ids': [(6, 0, company.product_tags.ids if company.product_tags else [])]
                    }
                    self.env['documents.document'].create(document_dict)
                return True
        return document_ids
