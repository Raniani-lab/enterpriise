# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from freezegun import freeze_time
from unittest.mock import patch

from odoo import fields
from odoo.addons.account_online_synchronization.tests.common import AccountOnlineSynchronizationCommon
from odoo.tests import tagged

_logger = logging.getLogger(__name__)

@tagged('post_install', '-at_install')
class TestAccountOnlineAccount(AccountOnlineSynchronizationCommon):

    @freeze_time('2023-08-01')
    def test_get_filtered_transactions(self):
        """ This test verifies that duplicate transactions are filtered """
        self.BankStatementLine.with_context(skip_statement_line_cron_trigger=True).create({
            'date': '2023-08-01',
            'journal_id': self.gold_bank_journal.id,
            'online_transaction_identifier': 'ABCD01',
            'payment_ref': 'transaction_ABCD01',
            'amount': 10.0,
        })

        transactions_to_filtered = [
            self._create_one_online_transaction(transaction_identifier='ABCD01'),
            self._create_one_online_transaction(transaction_identifier='ABCD02'),
        ]

        filtered_transactions = self.account_online_account._get_filtered_transactions(transactions_to_filtered)

        self.assertEqual(
            filtered_transactions,
            [
                {
                    'payment_ref': 'transaction_ABCD02',
                    'date': '2023-08-01',
                    'online_transaction_identifier': 'ABCD02',
                    'amount': 10.0,
                    'partner_name': None,
                }
            ]
        )

    @freeze_time('2023-08-01')
    def test_format_transactions(self):
        transactions_to_format = [
            self._create_one_online_transaction(transaction_identifier='ABCD01'),
            self._create_one_online_transaction(transaction_identifier='ABCD02'),
        ]
        formatted_transactions = self.account_online_account._format_transactions(transactions_to_format)
        self.assertEqual(
            formatted_transactions,
            [
                {
                    'payment_ref': 'transaction_ABCD01',
                    'date': fields.Date.from_string('2023-08-01'),
                    'online_transaction_identifier': 'ABCD01',
                    'amount': 10.0,
                    'online_account_id': self.account_online_account.id,
                    'journal_id': self.gold_bank_journal.id,
                    'partner_name': None,
                },
                {
                    'payment_ref': 'transaction_ABCD02',
                    'date': fields.Date.from_string('2023-08-01'),
                    'online_transaction_identifier': 'ABCD02',
                    'amount': 10.0,
                    'online_account_id': self.account_online_account.id,
                    'journal_id': self.gold_bank_journal.id,
                    'partner_name': None,
                },
            ]
        )

    @freeze_time('2023-08-01')
    def test_format_transactions_invert_sign(self):
        transactions_to_format = [
            self._create_one_online_transaction(transaction_identifier='ABCD01', amount=25.0),
        ]
        self.account_online_account.inverse_transaction_sign = True
        formatted_transactions = self.account_online_account._format_transactions(transactions_to_format)
        self.assertEqual(
            formatted_transactions,
            [
                {
                    'payment_ref': 'transaction_ABCD01',
                    'date': fields.Date.from_string('2023-08-01'),
                    'online_transaction_identifier': 'ABCD01',
                    'amount': -25.0,
                    'online_account_id': self.account_online_account.id,
                    'journal_id': self.gold_bank_journal.id,
                    'partner_name': None,
                },
            ]
        )

    @freeze_time('2023-07-25')
    @patch('odoo.addons.account_online_synchronization.models.account_online.AccountOnlineLink._fetch_odoo_fin')
    def test_retrieve_pending_transactions(self, patched_fetch_odoofin):
        self.account_online_link.state = 'connected'
        patched_fetch_odoofin.side_effect = [{
            'transactions': [
                self._create_one_online_transaction(transaction_identifier='ABCD01', date='2023-07-06'),
                self._create_one_online_transaction(transaction_identifier='ABCD02', date='2023-07-22'),
            ],
            'pendings': [
                self._create_one_online_transaction(transaction_identifier='ABCD03_pending', date='2023-07-25'),
                self._create_one_online_transaction(transaction_identifier='ABCD04_pending', date='2023-07-25'),
            ]
        }]

        start_date = fields.Date.from_string('2023-07-01')
        result = self.account_online_account._retrieve_transactions(date=start_date, include_pendings=True)
        self.assertEqual(
            result,
            {
                'transactions': [
                    {
                        'payment_ref': 'transaction_ABCD01',
                        'date': fields.Date.from_string('2023-07-06'),
                        'online_transaction_identifier': 'ABCD01',
                        'amount': 10.0,
                        'partner_name': None,
                        'online_account_id': self.account_online_account.id,
                        'journal_id': self.gold_bank_journal.id,
                    },
                    {
                        'payment_ref': 'transaction_ABCD02',
                        'date': fields.Date.from_string('2023-07-22'),
                        'online_transaction_identifier': 'ABCD02',
                        'amount': 10.0,
                        'partner_name': None,
                        'online_account_id': self.account_online_account.id,
                        'journal_id': self.gold_bank_journal.id,
                    }
                ],
                'pendings': [
                    {
                        'payment_ref': 'transaction_ABCD03_pending',
                        'date': fields.Date.from_string('2023-07-25'),
                        'online_transaction_identifier': 'ABCD03_pending',
                        'amount': 10.0,
                        'partner_name': None,
                        'online_account_id': self.account_online_account.id,
                        'journal_id': self.gold_bank_journal.id,
                    },
                    {
                        'payment_ref': 'transaction_ABCD04_pending',
                        'date': fields.Date.from_string('2023-07-25'),
                        'online_transaction_identifier': 'ABCD04_pending',
                        'amount': 10.0,
                        'partner_name': None,
                        'online_account_id': self.account_online_account.id,
                        'journal_id': self.gold_bank_journal.id,
                    }
                ]
            }
        )
