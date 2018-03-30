# -*- coding: utf-8 -*-

from odoo import api, models
from odoo.tools.misc import formatLang

class AccountReconciliation(models.AbstractModel):
    _inherit = 'account.reconciliation.widget'

    ####################################################
    # Public
    ####################################################

    @api.model
    def get_move_lines_by_batch_deposit(self, st_line_id, batch_deposit_id):
        """ As get_move_lines_for_bank_statement_line, but returns lines from a batch deposit """
        st_line = self.env['account.bank.statement.line'].browse(st_line_id)
        move_lines = self.env['account.move.line']
        # batch deposits from any journal can be selected in bank statement reconciliation widget,
        # so we need to filter not only on lines of type 'liquidity' but also on any bank/cash
        # account set as 'Allow Reconciliation'.
        move_lines = self.env['account.move.line']
        for payment in self.env['account.batch.deposit'].browse(batch_deposit_id).payment_ids:
            journal_accounts = [payment.journal_id.default_debit_account_id.id, payment.journal_id.default_credit_account_id.id]
            move_lines |= payment.move_line_ids.filtered(lambda r: r.account_id.id in journal_accounts)

        target_currency = st_line.currency_id or st_line.journal_id.currency_id or st_line.journal_id.company_id.currency_id
        return self._prepare_move_lines(move_lines, target_currency=target_currency, target_date=st_line.date)

    @api.model
    def get_batch_deposits_data(self, bank_statement_ids):
        """ Return a list of dicts containing informations about unreconciled batch deposits """

        Batch_deposit = self.env['account.batch.deposit']

        batch_deposits = []
        batch_deposits_domain = [('state', '!=', 'reconciled')]

        for batch_deposit in Batch_deposit.search(batch_deposits_domain, order='id asc'):
            payments = batch_deposit.payment_ids
            journal = batch_deposit.journal_id
            company_currency = journal.company_id.currency_id
            journal_currency = journal.currency_id or company_currency

            amount_journal_currency = formatLang(self.env, batch_deposit.amount, currency_obj=journal_currency)
            amount_deposit_currency = False
            # If all the payments of the deposit are in another currency than the journal currency, we'll display amount in both currencies
            if payments and all(p.currency_id != journal_currency and p.currency_id == payments[0].currency_id for p in payments):
                amount_deposit_currency = sum(p.amount for p in payments)
                amount_deposit_currency = formatLang(self.env, amount_deposit_currency, currency_obj=payments[0].currency_id or company_currency)

            batch_deposits.append({
                'id': batch_deposit.id,
                'name': batch_deposit.name,
                'journal_id': journal.id,
                'amount_str': amount_journal_currency,
                'amount_currency_str': amount_deposit_currency,
            })
        return batch_deposits

    @api.model
    def get_bank_statement_data(self, bank_statement_ids):
        """ Add batch deposits data to the dict returned """
        res = super(AccountReconciliation, self).get_bank_statement_data(bank_statement_ids)
        res.update({'batch_deposits': self.get_batch_deposits_data(bank_statement_ids)})
        return res
