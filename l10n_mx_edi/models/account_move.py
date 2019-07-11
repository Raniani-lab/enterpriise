# -*- coding: utf-8 -*-
import re

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    l10n_mx_edi_customs_number = fields.Char(
        help='Optional field for entering the customs information in the case '
        'of first-hand sales of imported goods or in the case of foreign trade'
        ' operations with goods or services.\n'
        'The format must be:\n'
        ' - 2 digits of the year of validation followed by two spaces.\n'
        ' - 2 digits of customs clearance followed by two spaces.\n'
        ' - 4 digits of the serial number followed by two spaces.\n'
        ' - 1 digit corresponding to the last digit of the current year, '
        'except in case of a consolidated customs initiated in the previous '
        'year of the original request for a rectification.\n'
        ' - 6 digits of the progressive numbering of the custom.',
        string='Customs number',
        copy=False)

    def reconcile(self, writeoff_acc_id=False, writeoff_journal_id=False):
        """Create payment complement with a full reconciliation"""
        res = super(AccountMoveLine, self).reconcile(
            writeoff_acc_id, writeoff_journal_id)
        # return if the call is not from a manual reconciliation
        if not self._context.get('l10n_mx_edi_manual_reconciliation', True):
            return res
        for pay in self.mapped('payment_id'):
            pay.write({'invoice_ids': [
                (6, 0, pay.reconciled_invoice_ids.ids)]})
            if pay.l10n_mx_edi_is_required() and pay.l10n_mx_edi_pac_status != 'signed':
                pay.l10n_mx_edi_cfdi_name = ('%s-%s-MX-Payment-10.xml' % (
                    pay.journal_id.code, pay.name))
                pay._l10n_mx_edi_retry()
        return res

    @api.constrains('l10n_mx_edi_customs_number')
    def _check_l10n_mx_edi_customs_number(self):
        """Check the validity of the 'l10n_mx_edi_customs_number' field."""
        pattern = re.compile(r'[0-9]{2}  [0-9]{2}  [0-9]{4}  [0-9]{7}')
        invalid_product_names = []
        for line in self.filtered(lambda line: line.l10n_mx_edi_customs_number):
            for ped in line.l10n_mx_edi_customs_number.split(','):
                if not pattern.match(ped.strip()):
                    invalid_product_names.append(line.product_id.name)
        if invalid_product_names:
            help_message = self.filtered(
                lambda line: not line.exclude_from_invoice_tab).fields_get().get(
                    'l10n_mx_edi_customs_number').get('help').split('\n', 1)[1]
            raise ValidationError(_(
                'Error in the products:\n%s\n\n The format of the customs '
                'number is incorrect. %s\n For example: 15  48  3009  0001234') % (
                    '\n'.join(invalid_product_names), help_message))
