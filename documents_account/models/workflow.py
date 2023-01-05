# -*- coding: utf-8 -*-
from odoo import models, fields


class WorkflowActionRuleAccount(models.Model):
    _inherit = ['documents.workflow.rule']

    create_model = fields.Selection(selection_add=[('account.move.in_invoice', "Vendor bill"),
                                                   ('account.move.out_invoice', 'Customer invoice'),
                                                   ('account.move.in_refund', 'Vendor Credit Note'),
                                                   ('account.move.out_refund', "Credit note"),
                                                   ('account.move.entry', "Miscellaneous Operations"),
                                                   ('account.bank.statement', "Bank Statement")])

    def create_record(self, documents=None):
        rv = super(WorkflowActionRuleAccount, self).create_record(documents=documents)
        if self.create_model.startswith('account.move'):
            invoice_type = self.create_model.split('.')[2]
            move = None
            invoice_ids = []

            # 'entry' are outside of document loop because the actions
            #  returned could be differents (cfr. l10n_be_soda)
            if invoice_type == 'entry':
                journal = self.env.company._get_default_misc_journal()
                return journal.create_document_from_attachment(attachment_ids=documents.attachment_id.ids)

            for document in documents:
                if document.res_model == 'account.move' and document.res_id:
                    move = self.env['account.move'].browse(document.res_id)
                else:
                    move = self.env['account.journal']\
                        .with_context(default_move_type=invoice_type)\
                        ._create_document_from_attachment(attachment_ids=document.attachment_id.id)
                partner = self.partner_id or document.partner_id
                if partner:
                    move.partner_id = partner
                if move.statement_line_id:
                    move['suspense_statement_line_id'] = move.statement_line_id.id

                invoice_ids.append(move.id)

            context = dict(self._context, default_move_type=invoice_type)
            action = {
                'type': 'ir.actions.act_window',
                'res_model': 'account.move',
                'name': "Invoices",
                'view_id': False,
                'view_mode': 'tree',
                'views': [(False, "list"), (False, "form")],
                'domain': [('id', 'in', invoice_ids)],
                'context': context,
            }
            if len(invoice_ids) == 1:
                record = move or self.env['account.move'].browse(invoice_ids[0])
                view_id = record.get_formview_id() if record else False
                action.update({
                    'view_mode': 'form',
                    'views': [(view_id, "form")],
                    'res_id': invoice_ids[0],
                    'view_id': view_id,
                })
            return action

        elif self.create_model == 'account.bank.statement':
            # only the journal type is checked as journal will be retrieved from
            # the bank account later on. Also it is not possible to link the doc
            # to the newly created entry as they can be more than one. But importing
            # many times the same bank statement is later checked.
            default_journal = self.env['account.journal'].search([('type', '=', 'bank')], limit=1)
            return default_journal.create_document_from_attachment(attachment_ids=documents.attachment_id.ids)

        return rv
