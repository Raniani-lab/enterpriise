# -*- coding: utf-8 -*-
from odoo import models

import ast


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    def action_open_bank_balance_in_gl(self):
        ''' Show the bank balance inside the General Ledger report.
        :return: An action opening the General Ledger.
        '''
        self.ensure_one()
        action = self.env.ref('account_reports.action_account_report_general_ledger').read()[0]

        account_to_show = self.default_debit_account_id or self.default_credit_account_id
        action['context'] = {
            **ast.literal_eval(action['context']),
            'default_options': {'filter_accounts': account_to_show.code},
        }

        return action
