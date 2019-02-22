# -*- coding: utf-8 -*-
from odoo import models, fields, api, exceptions


class WorkflowActionRuleAccount(models.Model):
    _inherit = ['documents.workflow.rule']

    has_business_option = fields.Boolean(default=True, compute='_get_business')
    create_model = fields.Selection(selection_add=[('account.invoice.in_invoice', "Vendor bill"),
                                                   ('account.invoice.out_refund', "Credit note"),
                                                   ('account.invoice.in_refund', 'Vendor Credit Note')])

    def create_record(self, documents=None):
        rv = super(WorkflowActionRuleAccount, self).create_record(documents=documents)
        if self.create_model.startswith('account.invoice'):
            invoice_type = self.create_model.split('.')[2]
            journal = self.env['account.invoice'].with_context({'type': invoice_type})._default_journal()
            new_obj = None
            invoice_ids = []
            for document in documents:
                create_values = {
                    'type': invoice_type,
                    'journal_id': journal.id,
                }
                if invoice_type != 'out_refound':
                    create_values['comment'] = False

                if self.partner_id:
                    create_values.update(partner_id=self.partner_id.id)
                elif document.partner_id:
                    create_values.update(partner_id=document.partner_id.id)

                if document.res_model == 'account.invoice' and document.res_id:
                    invoice_ids.append(document.res_id)
                else:
                    new_obj = self.env['account.invoice'].create(create_values)
                    body = "<p>created with Documents</p>"
                    new_obj.message_post(body=body, attachment_ids=[document.attachment_id.id])

                    # the 'no_document' key in the context indicates that this ir_attachment has already a
                    # documents.document and a new document shouldn't be automatically generated.
                    document.attachment_id.with_context(no_document=True).write({
                        'res_model': 'account.invoice',
                        'res_id': new_obj.id,
                    })
                    invoice_ids.append(new_obj.id)

            action = {
                'type': 'ir.actions.act_window',
                'res_model': 'account.invoice',
                'name': "Invoices",
                'view_id': False,
                'view_type': 'list',
                'view_mode': 'tree',
                'views': [(False, "list"), (False, "form")],
                'domain': [('id', 'in', invoice_ids)],
                'context': self._context,
            }
            if len(invoice_ids) == 1:
                record = new_obj or self.env['account.invoice'].browse(invoice_ids[0])
                view_id = record.get_formview_id() if record else False
                action.update({
                    'view_type': 'form',
                    'view_mode': 'form',
                    'views': [(view_id, "form")],
                    'res_id': invoice_ids[0],
                    'view_id': view_id,
                })
            return action
        return rv
