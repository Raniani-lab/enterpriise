# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.osv import expression


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'

    reconciliation_move_line_id = fields.Many2one('account.move.line', string='Reconciliation Journal Entry Line')

    @api.multi
    def _get_domain_edition_mode_available(self):
        domain = super(AccountInvoice, self)._get_domain_edition_mode_available()
        return expression.OR([
            domain,
            [('reconciliation_invoice_id', '=', self.id)]
        ])

    @api.multi
    def action_reconcile_to_check(self, params):
        action = super(AccountInvoice, self).action_reconcile_to_check(params)
        line = self.reconciliation_move_line_id
        if line:
            if not line.partner_id:
                line.partner_id = self.partner_id
            action['context']['statement_line_ids'] = [line.statement_line_id.id]

        return action

    @api.multi
    def write(self, vals):
        main_attachment_id = vals.get('message_main_attachment_id')
        # We assume that main_attachment_id is written on a single record,
        # since the current flows are going this way. Ensuring that we have only one record will avoid performance issue
        # when writing on invoices in batch.
        # To make it work in batch if we want to update multiple main_attachment_ids simultaneously,
        # most of this function may need to be rewritten.
        if main_attachment_id and not self._context.get('no_document') and len(self) == 1:
            previous_attachment_id = self.message_main_attachment_id.id
            document = False
            if previous_attachment_id:
                document = self.env['documents.document'].sudo().search([('attachment_id', '=', previous_attachment_id)], limit=1)
            if document:
                document.attachment_id = main_attachment_id
            else:
                if self.type == 'in_invoice' and self.company_id.documents_account_settings:
                    setting = self.env['documents.account.folder.setting'].sudo().search(
                        [('journal_id', '=', self.journal_id.id),
                         ('company_id', '=', self.company_id.id)], limit=1)
                    if setting:
                        self.env['documents.document'].sudo().create({
                            'attachment_id': main_attachment_id,
                            'folder_id': setting.folder_id.id,
                            'partner_id': self.partner_id.id,
                            'owner_id': self.create_uid.id,
                            'tag_ids': [(6, 0, setting.tag_ids.ids if setting.tag_ids else [])]
                        })
        return super(AccountInvoice, self).write(vals)
