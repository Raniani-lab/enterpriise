# -*- coding: utf-8 -*-
from odoo import models, fields, api, exceptions


class WorkflowActionRuleProduct(models.Model):
    _inherit = ['documents.workflow.rule']

    has_business_option = fields.Boolean(default=True, compute='_get_business')
    create_model = fields.Selection(selection_add=[('product.template', "Product template")])

    def create_record(self, documents=None):
        rv = super(WorkflowActionRuleProduct, self).create_record(documents=documents)
        if self.create_model == 'product.template':
            new_obj = self.env[self.create_model].create({'name': 'product created from Documents'})

            for document in documents:
                this_document = document
                if (document.res_model or document.res_id) and document.res_model != 'documents.document':
                    this_document = document.copy()
                    attachment_id_copy = document.attachment_id.with_context(no_document=True).copy()
                    this_document.write({'attachment_id': attachment_id_copy.id})

                # the 'no_document' key in the context indicates that this ir_attachment has already a
                # documents.document and a new document shouldn't be automatically generated.
                this_document.attachment_id.with_context(no_document=True).write({
                    'res_model': self.create_model,
                    'res_id': new_obj.id,
                })

            view_id = new_obj.get_formview_id()
            return {
                'type': 'ir.actions.act_window',
                'res_model': 'product.template',
                'name': "New product template",
                'context': self._context,
                'view_type': 'form',
                'view_mode': 'form',
                'views': [(view_id, "form")],
                'res_id': new_obj.id if new_obj else False,
                'view_id': view_id,
            }
        return rv
