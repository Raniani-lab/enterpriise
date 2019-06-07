# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# Copyright (c) 2012 Noviat nv/sa (www.noviat.be). All rights reserved.

import time
import re

from odoo import models, fields, tools, _
from odoo.exceptions import UserError

# Mappings for the structured communication formats
minimum = {'1': _('minimum applicable'), '2': _('minimum not applicable')}
card_scheme = {'1': _('Bancontact/Mister Cash'), '2': _('Maestro'), '3': _('Private'), '5': _('TINA'), '9': _('Other')}
transaction_type = {'0': _('cumulative'), '1': _('withdrawal'), '2': _('cumulative on network'), '4': _('reversal of purchases'), '5': _('POS others'), '7': _('distribution sector'), '8': _('teledata'), '9': _('fuel')}
product_code = {'00': _('unset'), '01': _('premium with lead substitute'), '02': _('europremium'), '03': _('diesel'), '04': _('LPG'), '06': _('premium plus 98 oct'), '07': _('regular unleaded'), '08': _('domestic fuel oil'), '09': _('lubricants'), '10': _('petrol'), '11': _('premium 99+'), '12': _('Avgas'), '16': _('other types')}
issuing_institution = {'1': 'Mastercard', '2': 'Visa', '3': 'American Express', '4': 'Diners Club', '9': 'Other'}
type_direct_debit = {'0': _('unspecified'), '1': _('recurrent'), '2': _('one-off'), '3': _('1-st (recurrent)'), '4': _('last (recurrent)')}
direct_debit_scheme = {'0': _('unspecified'), '1': _('SEPA core'), '2': _('SEPA B2B')}
payment_reason = {'0': _('paid'), '1': _('technical problem'), '2': _('reason not specified'), '3': _('debtor disagrees'), '4': _('debtor’s account problem')}
sepa_type = {'0': _('paid'), '1': _('reject'), '2': _('return'), '3': _('refund'), '4': _('reversal'), '5': _('cancellation')}

class AccountBankStatementImport(models.TransientModel):
    _inherit = 'account.bank.statement.import'

    split_transactions = fields.Boolean()

    def _check_coda(self, data_file):
        # Matches the first 24 characters of a CODA file, as defined by the febelfin specifications
        return re.match(b'0{5}\d{9}05[ D] +', data_file) is not None

    def _parse_file(self, data_file):
        if not self._check_coda(data_file):
            return super(AccountBankStatementImport, self)._parse_file(data_file)

        def rmspaces(s):
            return " ".join(s.split())

        def parsedate(s):
            if s == '999999':
                return _('No date')
            return "{day}/{month}/{year}".format(day=s[:2], month=s[2:4], year=s[4:])

        def parsehour(s):
            return "{hour}:{minute}".format(hour=s[:2], minute=s[2:])

        def parsefloat(s, precision):
            return str(float(rmspaces(s)) / (10 ** precision))

        def parse_terminal(s):
            return _('Name: {name}, Town: {city}').format(name=rmspaces(s[:16]), city=rmspaces(s[16:]))

        def parse_operation(type, family, operation, category):
            return "{type}: {family} ({operation})".format(
                type=sepa_transaction_type[type],
                family=transaction_code[family][0],
                operation=transaction_code[family][1].get(operation, default_transaction_code.get(operation, _('undefined')))
            )

        def parse_structured_communication(type, communication):
            note = []
            p_idx = 0 ; o_idx = 0
            if type == '100':  # RF Creditor Reference
                structured_com = rmspaces(communication[:25])
            elif type in ('101', '102'):  # Credit transfer or cash payment with structured format communication or with reconstituted structured format communication
                structured_com = '+++' + communication[:3] + '/' + communication[3:7] + '/' + communication[7:12] + '+++'
            elif type == '103':  # number (e.g. of the cheque, of the card, etc.)
                structured_com = rmspaces(communication[:12])
            elif type == '105':  # Original amount of the transaction
                structured_com = _('Original amount of the transaction')
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('Gross amount in the currency of the account') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('Gross amount in the original currency') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('Rate') + ': ' + parsefloat(communication[o_idx:p_idx], 8))
                o_idx = p_idx; p_idx +=  3; note.append(_('Detail') + ': ' + _('Currency') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('Structured format communication') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  2; note.append(_('Detail') + ': ' + _('Country code of the principal') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('Equivalent in EUR') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
            elif type == '106':  # Method of calculation (VAT, withholding tax on income, commission, etc.)
                structured_com = _('Method of calculation (VAT, withholding tax on income, commission, etc.)')
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('equivalent in the currency of the account') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('amount on which % is calculated') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('percent') + ': ' + parsefloat(communication[o_idx:p_idx], 8))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('minimum') + ': ' + minimum[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('equivalent in EUR') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
            elif type == '108':  # Closing
                structured_com = _('Closing')
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('equivalent in the currency of the account') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('interest rates, calculation basis') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('interest') + ': ' + parsefloat(communication[o_idx:p_idx], 8))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('period from {} to {}').format(parsedate(communication[o_idx:o_idx+6]), parsedate(communication[o_idx+6:o_idx+12])))
            elif type == '111':  # POS credit – Globalisation
                structured_com = _('POS credit – Globalisation')
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('card scheme') + ': ' + card_scheme[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('POS number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  3; note.append(_('Detail') + ': ' + _('period number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('sequence number of first transaction') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('date of first transaction') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('sequence number of last transaction') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('date of last transaction') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('transaction type') + ': ' + transaction_type[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx += 26; note.append(_('Detail') + ': ' + _('identification of terminal') + ': ' + parse_terminal(communication[o_idx:p_idx]))
            elif type == '113':  # ATM/POS debit
                structured_com = _('ATM/POS debit')
                o_idx = p_idx; p_idx += 16; note.append(_('Detail') + ': ' + _('Masked PAN or card number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('card scheme') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('terminal number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('sequence number of transaction') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('date of transaction') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  4; note.append(_('Detail') + ': ' + _('hour of transaction') + ': ' + parsehour(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('transaction type') + ': ' + transaction_type[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx += 26; note.append(_('Detail') + ': ' + _('identification of terminal') + ': ' + parse_terminal(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('original amount') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('rate') + ': ' + parsefloat(communication[o_idx:p_idx], 8))
                o_idx = p_idx; p_idx +=  3; note.append(_('Detail') + ': ' + _('currency') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  5; note.append(_('Detail') + ': ' + _('volume') + ': ' + parsefloat(communication[o_idx:p_idx], 2))
                o_idx = p_idx; p_idx +=  2; note.append(_('Detail') + ': ' + _('product code') + ': ' + product_code[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx +=  5; note.append(_('Detail') + ': ' + _('unit price') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
            elif type == '114':  # POS credit - individual transaction
                structured_com = _('POS credit - individual transaction')
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('card scheme') + ': ' + card_scheme[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('POS number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  3; note.append(_('Detail') + ': ' + _('period number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('sequence number of transaction') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('date of transaction') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  4; note.append(_('Detail') + ': ' + _('hour of transaction') + ': ' + parsehour(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('transaction type') + ': ' + transaction_type[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx += 26; note.append(_('Detail') + ': ' + _('identification of terminal') + ': ' + parse_terminal(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 16; note.append(_('Detail') + ': ' + _('reference of transaction') + ': ' + rmspaces(communication[o_idx:p_idx]))
            elif type == '115':  # Terminal cash deposit
                structured_com = _('Terminal cash deposit')
                o_idx = p_idx; p_idx += 16; note.append(_('Detail') + ': ' + _('PAN or card number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('card scheme') + ': ' + card_scheme[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('terminal number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('sequence number of transaction') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('payment day') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  4; note.append(_('Detail') + ': ' + _('hour of payment') + ': ' + parsehour(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('validation date') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('sequence number of validation') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('original amount (given by the customer)') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('conformity code or blank') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 26; note.append(_('Detail') + ': ' + _('identification of terminal') + ': ' + parse_terminal(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('message (structured of free)') + ': ' + rmspaces(communication[o_idx:p_idx]))
            elif type == '121':  # Commercial bills
                structured_com = _('Commercial bills')
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('amount of the bill') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('maturity date of the bill') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('conventional maturity date') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('date of issue of the bill') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 11; note.append(_('Detail') + ': ' + _('company number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  3; note.append(_('Detail') + ': ' + _('currency') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  3;  # blanks
                o_idx = p_idx; p_idx += 13; note.append(_('Detail') + ': ' + _('number of the bill') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('exchange rate') + ': ' + parsefloat(communication[o_idx:p_idx], 8))
            elif type == '122':  # Bills - calculation of interest
                structured_com = _('Bills - calculation of interest')
                o_idx = p_idx; p_idx +=  4; note.append(_('Detail') + ': ' + _('number of days') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('interest rate') + ': ' + parsefloat(communication[o_idx:p_idx], 8))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('basic amount of the calculation') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('minimum rate') + ': ' + minimum[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx += 13; note.append(_('Detail') + ': ' + _('number of the bill') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('maturity date of the bill') + ': ' + parsedate(communication[o_idx:p_idx]))
            elif type == '123':  # Fees and commissions
                structured_com = _('Fees and commissions')
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('starting date') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('maturity date') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('basic amount') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('percentage') + ': ' + parsefloat(communication[o_idx:p_idx], 8))
                o_idx = p_idx; p_idx +=  4; note.append(_('Detail') + ': ' + _('term in days') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('minimum rate') + ': ' + minimum[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx += 13; note.append(_('Detail') + ': ' + _('guarantee number (no. allocated by the bank)') + ': ' + rmspaces(communication[o_idx:p_idx]))
            elif type == '124':  # Number of the credit card
                structured_com = _('Number of the credit card')
                o_idx = p_idx; p_idx += 20; note.append(_('Detail') + ': ' + _('Masked PAN or card number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('issuing institution') + ': ' + issuing_institution[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('invoice number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('identification number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('date') + ': ' + parsedate(communication[o_idx:p_idx]))
            elif type == '125':  # Credit
                structured_com = _('Credit')
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('account number of the credit') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('extension zone of account number of the credit') + ': ' + rmspaces(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('old balance of the credit') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('new balance of the credit') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('amount (equivalent in foreign currency)') + ': ' + parsefloat(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  3; note.append(_('Detail') + ': ' + _('currency') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('starting date') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('end date') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('nominal interest rate or rate of charge') + ': ' + parsefloat(communication[o_idx:p_idx], 8))
                o_idx = p_idx; p_idx += 13; note.append(_('Detail') + ': ' + _('reference of transaction on credit account') + ': ' + rmspaces(communication[o_idx:p_idx]))
            elif type == '126':  # Term Investments
                structured_com = _('Term Investments')
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('deposit number') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('deposit amount') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('equivalent in the currency of the account') + ': ' + parsefloat(communication[o_idx:p_idx], 3))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('starting date') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('end date') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('interest rate') + ': ' + parsefloat(communication[o_idx:p_idx], 8))
                o_idx = p_idx; p_idx += 15; note.append(_('Detail') + ': ' + _('amount of interest') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  3; note.append(_('Detail') + ': ' + _('currency') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 12; note.append(_('Detail') + ': ' + _('rate') + ': ' + parsefloat(communication[o_idx:p_idx], 8))
            elif type == '127':  # SEPA
                structured_com = _('SEPA Direct Debit')
                o_idx = p_idx; p_idx +=  6; note.append(_('Detail') + ': ' + _('Settlement Date') + ': ' + parsedate(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('Type Direct Debit') + ': ' + type_direct_debit[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('Direct Debit scheme') + ': ' + direct_debit_scheme[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('Paid or reason for refused payment') + ': ' + payment_reason[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx += 35; note.append(_('Detail') + ': ' + _('Creditor’s identification code') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 35; note.append(_('Detail') + ': ' + _('Mandate reference') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx += 62; note.append(_('Detail') + ': ' + _('Communicaton') + ': ' + rmspaces(communication[o_idx:p_idx]))
                o_idx = p_idx; p_idx +=  1; note.append(_('Detail') + ': ' + _('Type of R transaction') + ': ' + sepa_type[communication[o_idx:p_idx]])
                o_idx = p_idx; p_idx +=  4; note.append(_('Detail') + ': ' + _('Reason') + ': ' + rmspaces(communication[o_idx:p_idx]))
            else:
                note.append(_('Type of structured communication not supported: ' + type))
                note.append(communication)
            return note

        pattern = re.compile("[\u0020-\u1EFF\n\r]+")  # printable characters
        # Try different encodings for the file
        for encoding in ('cp850', 'cp858', 'cp1140', 'cp1252', 'iso8859_15', 'utf_32', 'utf_16', 'utf_8', 'windows-1252'):
            try:
                record_data = data_file.decode(encoding)
            except UnicodeDecodeError:
                continue
            if pattern.fullmatch(record_data, re.MULTILINE):
                break  # We only have printable characters, stick with this one

        recordlist = record_data.split(u'\n')
        statements = []
        globalisation_comm = {}
        for line in recordlist:
            if not line:
                pass
            elif line[0] == '0':
                #Begin of a new Bank statement
                statement = {}
                statements.append(statement)
                statement['version'] = line[127]
                if statement['version'] not in ['1', '2']:
                    raise UserError(_('Error') + ' R001: ' + _('CODA V%s statements are not supported, please contact your bank') % statement['version'])
                statement['globalisation_stack'] = []
                statement['lines'] = []
                statement['date'] = time.strftime(tools.DEFAULT_SERVER_DATE_FORMAT, time.strptime(rmspaces(line[5:11]), '%d%m%y'))
                statement['separateApplication'] = rmspaces(line[83:88])
            elif line[0] == '1':
                #Statement details
                if statement['version'] == '1':
                    statement['acc_number'] = rmspaces(line[5:17])
                    statement['currency'] = rmspaces(line[18:21])
                elif statement['version'] == '2':
                    if line[1] == '0':  # Belgian bank account BBAN structure
                        statement['acc_number'] = rmspaces(line[5:17])
                        # '11' and '14' stand respecively for characters 'B' and 'E', it's a constant for Belgium, that we need to append to the account number before computing the check digits
                        statement['acc_number'] = 'BE%02d' % (98 - int(statement['acc_number'] + '111400') % 97) + statement['acc_number']
                        statement['currency'] = rmspaces(line[18:21])
                    elif line[1] == '1':  # foreign bank account BBAN structure
                        raise UserError(_('Error') + ' R1001: ' + _('Foreign bank accounts with BBAN structure are not supported '))
                    elif line[1] == '2':    # Belgian bank account IBAN structure
                        statement['acc_number'] = rmspaces(line[5:21])
                        statement['currency'] = rmspaces(line[39:42])
                    elif line[1] == '3':    # foreign bank account IBAN structure
                        raise UserError(_('Error') + ' R1002: ' + _('Foreign bank accounts with IBAN structure are not supported '))
                    else:  # Something else, not supported
                        raise UserError(_('Error') + ' R1003: ' + _('Unsupported bank account structure '))
                statement['description'] = rmspaces(line[90:125])
                statement['balance_start'] = float(rmspaces(line[43:58])) / 1000
                if line[42] == '1':  # 1 = Debit, the starting balance is negative
                    statement['balance_start'] = - statement['balance_start']
                statement['balance_start_date'] = time.strftime(tools.DEFAULT_SERVER_DATE_FORMAT, time.strptime(rmspaces(line[58:64]), '%d%m%y')) if rmspaces(line[58:64]) != '000000' else statement['date']
                statement['accountHolder'] = rmspaces(line[64:90])
                statement['paperSeqNumber'] = rmspaces(line[2:5])
                statement['codaSeqNumber'] = rmspaces(line[125:128])
            elif line[0] == '2':
                if line[1] == '1':
                    #New statement line
                    statementLine = {}
                    statementLine['ref'] = rmspaces(line[2:10])
                    statementLine['ref_move'] = rmspaces(line[2:6])
                    statementLine['ref_move_detail'] = rmspaces(line[6:10])
                    statementLine['sequence'] = len(statement['lines']) + 1
                    statementLine['transactionRef'] = rmspaces(line[10:31])
                    statementLine['debit'] = line[31]  # 0 = Credit, 1 = Debit
                    statementLine['amount'] = float(rmspaces(line[32:47])) / 1000
                    if statementLine['debit'] == '1':
                        statementLine['amount'] = - statementLine['amount']
                    statementLine['transactionDate'] = time.strftime(tools.DEFAULT_SERVER_DATE_FORMAT, time.strptime(rmspaces(line[47:53]), '%d%m%y')) if rmspaces(line[47:53]) != '000000' else statement['date']
                    statementLine['transaction_type'] = int(rmspaces(line[53:54]))
                    statementLine['transaction_family'] = rmspaces(line[54:56])
                    statementLine['transaction_code'] = rmspaces(line[56:58])
                    statementLine['transaction_category'] = rmspaces(line[58:61])
                    if line[61] == '1':
                        #Structured communication
                        statementLine['communication_struct'] = True
                        statementLine['communication_type'] = line[62:65]
                        statementLine['communication'] = line[65:115]
                    else:
                        #Non-structured communication
                        statementLine['communication_struct'] = False
                        statementLine['communication'] = rmspaces(line[62:115])
                    statementLine['entryDate'] = time.strftime(tools.DEFAULT_SERVER_DATE_FORMAT, time.strptime(rmspaces(line[115:121]), '%d%m%y'))
                    statementLine['type'] = 'normal'
                    statementLine['globalisation'] = int(line[124])
                    if statementLine['globalisation'] > 0:
                        if statementLine['ref_move'] in statement['globalisation_stack']:
                            statement['globalisation_stack'].remove(statementLine['ref_move'])
                        else:
                            statementLine['type'] = 'globalisation'
                            statement['globalisation_stack'].append(statementLine['ref_move'])
                            globalisation_comm[statementLine['ref_move']] = statementLine['communication']
                    if not statementLine.get('communication'):
                        statementLine['communication'] = globalisation_comm.get(statementLine['ref_move'], '')
                    statement['lines'].append(statementLine)
                elif line[1] == '2':
                    if statement['lines'][-1]['ref'][0:4] != line[2:6]:
                        raise UserError(_('Error') + 'R2004: ' + _('CODA parsing error on movement data record 2.2, seq nr %s! Please report this issue via your Odoo support channel.') % line[2:10])
                    statement['lines'][-1]['communication'] += line[10:63]
                    statement['lines'][-1]['payment_reference'] = rmspaces(line[63:98])
                    statement['lines'][-1]['counterparty_bic'] = rmspaces(line[98:109])
                    # TODO 113, 114-117, 118-121, 122-125
                elif line[1] == '3':
                    if statement['lines'][-1]['ref'][0:4] != line[2:6]:
                        raise UserError(_('Error') + 'R2005: ' + _('CODA parsing error on movement data record 2.3, seq nr %s! Please report this issue via your Odoo support channel.') % line[2:10])
                    if statement['version'] == '1':
                        statement['lines'][-1]['counterpartyNumber'] = rmspaces(line[10:22])
                        statement['lines'][-1]['counterpartyName'] = rmspaces(line[47:73])
                        statement['lines'][-1]['counterpartyAddress'] = rmspaces(line[73:125])
                        statement['lines'][-1]['counterpartyCurrency'] = ''
                    else:
                        if line[22] == ' ':
                            statement['lines'][-1]['counterpartyNumber'] = rmspaces(line[10:22])
                            statement['lines'][-1]['counterpartyCurrency'] = rmspaces(line[23:26])
                        else:
                            statement['lines'][-1]['counterpartyNumber'] = rmspaces(line[10:44])
                            statement['lines'][-1]['counterpartyCurrency'] = rmspaces(line[44:47])
                        statement['lines'][-1]['counterpartyName'] = rmspaces(line[47:82])
                        statement['lines'][-1]['communication'] += line[82:125]
                else:
                    # movement data record 2.x (x != 1,2,3)
                    raise UserError(_('Error') + 'R2006: ' + _('\nMovement data records of type 2.%s are not supported ') % line[1])
            elif line[0] == '3':
                if line[1] == '1':
                    infoLine = {}
                    infoLine['entryDate'] = statement['lines'][-1]['entryDate']
                    infoLine['type'] = 'information'
                    infoLine['sequence'] = len(statement['lines']) + 1
                    infoLine['ref'] = rmspaces(line[2:10])
                    infoLine['transactionRef'] = rmspaces(line[10:31])
                    infoLine['transaction_family'] = rmspaces(line[32:34])
                    infoLine['transaction_code'] = rmspaces(line[34:36])
                    infoLine['transaction_category'] = rmspaces(line[36:39])
                    if line[39] == '1':
                        #Structured communication
                        infoLine['communication_struct'] = True
                        infoLine['communication_type'] = line[40:43]
                        infoLine['communication'] = line[43:113]
                    else:
                        #Non-structured communication
                        infoLine['communication_struct'] = False
                        infoLine['communication'] = rmspaces(line[62:115])
                    statement['lines'].append(infoLine)
                elif line[1] == '2':
                    if infoLine['ref'] != rmspaces(line[2:10]):
                        raise UserError(_('Error') + 'R3004: ' + _('CODA parsing error on information data record 3.2, seq nr %s! Please report this issue via your Odoo support channel.') % line[2:10])
                    statement['lines'][-1]['communication'] += rmspaces(line[10:115])
                elif line[1] == '3':
                    if infoLine['ref'] != rmspaces(line[2:10]):
                        raise UserError(_('Error') + 'R3005: ' + _('CODA parsing error on information data record 3.3, seq nr %s! Please report this issue via your Odoo support channel.') % line[2:10])
                    statement['lines'][-1]['communication'] += rmspaces(line[10:100])
            elif line[0] == '4':
                    comm_line = {}
                    comm_line['type'] = 'communication'
                    comm_line['sequence'] = len(statement['lines']) + 1
                    comm_line['ref'] = rmspaces(line[2:10])
                    comm_line['communication'] = rmspaces(line[32:112])
                    statement['lines'].append(comm_line)
            elif line[0] == '8':
                # new balance record
                statement['debit'] = line[41]
                statement['paperSeqNumber'] = rmspaces(line[1:4])
                statement['balance_end_real'] = float(rmspaces(line[42:57])) / 1000
                statement['balance_end_realDate'] = time.strftime(tools.DEFAULT_SERVER_DATE_FORMAT, time.strptime(rmspaces(line[57:63]), '%d%m%y'))
                if statement['debit'] == '1':    # 1=Debit
                    statement['balance_end_real'] = - statement['balance_end_real']
            elif line[0] == '9':
                statement['balanceMin'] = float(rmspaces(line[22:37])) / 1000
                statement['balancePlus'] = float(rmspaces(line[37:52])) / 1000
                if not statement.get('balance_end_real'):
                    statement['balance_end_real'] = statement['balance_start'] + statement['balancePlus'] - statement['balanceMin']
        ret_statements = []
        for i, statement in enumerate(statements):
            statement['coda_note'] = ''
            statement_line = []
            statement_data = {
                'name': int(statement['paperSeqNumber']),
                'date': statement['date'],
                'balance_start': statement['balance_start'],
                'balance_end_real': statement['balance_end_real'],
            }
            for line in statement['lines']:
                if line['type'] == 'information' and statement_line:
                    statement_line[-1]['note'] = "\n".join([statement_line[-1]['note'], line['type'].title() + ' with Ref. ' + str(line['ref']), 'Date: ' + str(line['entryDate']), 'Communication: '] + parse_structured_communication(line['communication_type'], line['communication']))
                elif line['type'] == 'communication':
                    statement['coda_note'] = "\n".join([statement['coda_note'], line['type'].title() + ' with Ref. ' + str(line['ref']), 'Ref: ', 'Communication: ' + line['communication'], ''])
                elif line['type'] == 'normal'\
                        or (line['type'] == 'globalisation' and line['ref_move'] in statement['globalisation_stack'] and line['transaction_type'] in [1, 2]):
                    note = []
                    if line.get('counterpartyName'):
                        note.append(_('Counter Party') + ': ' + line['counterpartyName'])
                    else:
                        line['counterpartyName'] = False
                    if line.get('counterpartyNumber'):
                        try:
                            if int(line['counterpartyNumber']) == 0:
                                line['counterpartyNumber'] = False
                        except:
                            pass
                        if line['counterpartyNumber']:
                            note.append(_('Counter Party Account') + ': ' + line['counterpartyNumber'])
                    else:
                        line['counterpartyNumber'] = False

                    if line.get('counterpartyAddress'):
                        note.append(_('Counter Party Address') + ': ' + line['counterpartyAddress'])
                    structured_com = False
                    if line['communication_struct']:
                        note.extend(parse_structured_communication(line['communication_type'], line['communication']))
                        line['communication'] = ""  # Structured communication is handled, dont show the coded comm in the notes
                    if line.get('communication', ''):
                        note.append(_('Communication') + ': ' + rmspaces(line['communication']))
                    if not self.split_transactions and statement_line and line['ref_move'] == statement_line[-1]['ref']:
                        statement_line[-1]['amount'] += line['amount']
                        statement_line[-1]['note'] += "\n" + "\n".join(note)
                    else:
                        line_data = {
                            'name': structured_com or (line.get('communication', '') != '' and line['communication'] or '/'),
                            'note': "\n".join(note),
                            'transaction_type': parse_operation(line['transaction_type'], line['transaction_family'], line['transaction_code'], line['transaction_category']),
                            'date': line['entryDate'],
                            'amount': line['amount'],
                            'account_number': line.get('counterpartyNumber', None),
                            'partner_name': line['counterpartyName'],
                            'ref': self.split_transactions and line['ref'] or line['ref_move'],
                            'sequence': line['sequence'],
                            'unique_import_id': str(statement['codaSeqNumber']) + '-' + str(statement['date']) + '-' + str(line['ref']),
                        }
                        if line_data['amount'] != 0:
                            statement_line.append(line_data)
            if statement['coda_note'] != '':
                statement_data.update({'coda_note': statement['coda_note']})
            statement_data.update({'transactions': statement_line})
            ret_statements.append(statement_data)
        currency_code = statement['currency']
        acc_number = statements[0] and statements[0]['acc_number'] or False
        return currency_code, acc_number, ret_statements
