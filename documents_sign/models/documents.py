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

        if vals.get('res_model') in {'sign.request', 'sign.template'} and vals.get('res_id'):
            sign = self.env[vals['res_model']].browse(vals.get('res_id'))
            if sign.exists() and sign.folder_id.exists():
                for record in self:
                    document_dict = {
                        'attachment_id': record.id,
                        'name': vals.get('name', record.name),
                        'folder_id': sign.folder_id.id if sign.folder_id else False,
                        'tag_ids': [(6, 0, sign.documents_tag_ids.ids if sign.documents_tag_ids else [])]
                    }
                    self.env['documents.document'].create(document_dict)
                return True
        return document_ids
