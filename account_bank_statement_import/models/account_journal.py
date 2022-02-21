# -*- coding: utf-8 -*-

from odoo import models, api, _
from odoo.exceptions import UserError


class AccountJournal(models.Model):
    _inherit = "account.journal"

    def _get_bank_statements_available_import_formats(self):
        """ Returns a list of strings representing the supported import formats.
        """
        return []

    def __get_bank_statements_available_sources(self):
        rslt = super(AccountJournal, self).__get_bank_statements_available_sources()
        formats_list = self._get_bank_statements_available_import_formats()
        if formats_list:
            formats_list.sort()
            import_formats_str = ', '.join(formats_list)
            rslt.append(("file_import", _("Import") + "(" + import_formats_str + ")"))
        return rslt

    def import_statement(self):
        """return action to import bank/cash statements. This button should be called only on journals with type =='bank'"""
        action = self.env['ir.actions.act_window']._for_xml_id(
            'account_bank_statement_import.action_account_bank_statement_import')
        # Note: this drops action['context'], which is a dict stored as a string, which is not easy to update
        action.update({'context': (u"{'journal_id': " + str(self.id) + u"}")})
        return action

    def create_invoice_from_attachment(self, attachment_ids=None):
        journal = self.browse(self.env.context.get('default_journal_id'))
        if journal.type in ('bank', 'cash'):
            attachments = self.env['ir.attachment'].browse(attachment_ids)
            if not attachments:
                raise UserError(_("No attachment was provided"))
            wizard = self.env['account.bank.statement.import'].create({
                'attachment_ids': attachments,
            })
            return wizard.with_context(
                journal_id=journal.id,
                active_id=wizard.id,
                default_journal_id=None,
            ).import_file()
        return super().create_invoice_from_attachment(attachment_ids)
