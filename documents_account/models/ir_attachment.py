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

        if vals.get('res_model') == 'account.invoice' and vals.get('res_id'):
            invoice = self.env['account.invoice'].browse(vals['res_id'])
            company = invoice.company_id
            if company.documents_account_settings and company.account_folder:
                for record in self:
                    document_dict = {
                        'attachment_id': record.id,
                        'name': vals.get('name', record.name),
                        'folder_id': company.account_folder.id,
                        'tag_ids': [(6, 0, company.account_tags.ids if company.account_tags else [])]
                    }
                    self.env['documents.document'].create(document_dict)
                    return True
        return document_ids
