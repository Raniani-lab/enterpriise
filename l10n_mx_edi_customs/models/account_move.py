# coding: utf-8
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
from odoo import _, api, models, fields
from odoo.exceptions import ValidationError


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

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

    @api.constrains('l10n_mx_edi_customs_number')
    def _check_l10n_mx_edi_customs_number(self):
        ''' Check the validity of the 'l10n_mx_edi_customs_number' field. '''
        pattern = re.compile(r'[0-9]{2}  [0-9]{2}  [0-9]{4}  [0-9]{7}')
        invalid_product_names = []
        for line in self.filtered(lambda line: line.l10n_mx_edi_customs_number):
            for ped in line.l10n_mx_edi_customs_number.split(','):
                if not pattern.match(ped.strip()):
                    invalid_product_names.append(line.product_id.name)
        if invalid_product_names:
            help_message = self.filtered(lambda line: not line.exclude_from_invoice_tab).fields_get().get('l10n_mx_edi_customs_number').get('help').split('\n', 1)[1]
            raise ValidationError(_('Error in the products:\n%s\n\n The format of the customs number is incorrect. %s\n '
                                    'For example: 15  48  3009  0001234') % ('\n'.join(invalid_product_names), help_message))
