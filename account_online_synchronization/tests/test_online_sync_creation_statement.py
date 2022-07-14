# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.addons.account_accountant.tests.test_bank_rec_widget import WizardForm
from odoo.tests import tagged
from odoo import fields, Command
from unittest.mock import patch


@tagged('post_install', '-at_install')
class TestSynchStatementCreation(AccountTestInvoicingCommon):
    def setUp(self):
        super(TestSynchStatementCreation, self).setUp()
        self.bnk_stmt = self.env['account.bank.statement']
        self.env.ref('base.EUR').active = True
        # Create an account.online.link and account.online.account and associate to journal bank
        self.bank_journal = self.env['account.journal'].create({
            'name': 'Bank_Online', 
            'type': 'bank', 
            'code': 'BNKon', 
            'currency_id': self.env.ref('base.EUR').id,
            'bank_statement_creation_groupby': 'none'})
        self.link_account = self.env['account.online.link'].create({'name': 'Test Bank'})
        self.online_account = self.env['account.online.account'].create({
            'name': 'MyBankAccount',
            'account_online_link_id': self.link_account.id,
            'journal_ids': [(6, 0, self.bank_journal.id)]
        })
        self.transaction_id = 1
        self.account = self.env['account.account'].create({
            'name': 'toto',
            'code': 'bidule',
            'account_type': 'asset_fixed'
        })

    # This method return a list of transactions with the given dates
    # amount for each transactions is 10
    def create_transactions(self, dates):
        transactions = []
        for date in dates:
            transactions.append({
                'online_transaction_identifier': self.transaction_id,
                'date': fields.Date.from_string(date),
                'payment_ref': 'transaction_' + str(self.transaction_id),
                'amount': 10,
            })
            self.transaction_id += 1
        return transactions

    def create_transaction_partner(self, date=False, partner_id=False, partner_info=False):
        tr = {
            'online_transaction_identifier': self.transaction_id,
            'date': fields.Date.from_string(date),
            'payment_ref': 'transaction_p',
            'amount': 50,
        }
        if partner_id:
            tr['partner_id'] = partner_id
        if partner_info:
            tr['online_partner_information'] = partner_info
        self.transaction_id += 1
        return [tr]

    def assertDate(self, date1, date2):
        if isinstance(date1, str):
            date1 = fields.Date.from_string(date1)
        if isinstance(date2, str):
            date2 = fields.Date.from_string(date2)
        self.assertEqual(date1, date2)

    def assertBankStatementValues(self, bank_stmnt_record, bank_stmnt_dict):
        for index in range(len(bank_stmnt_record)):
            bank_stmnt_line_dict = bank_stmnt_dict[index].pop('line_ids')
            debug = [bank_stmnt_dict[index]]
            self.assertRecordValues(bank_stmnt_record[index], debug)
            self.assertRecordValues(bank_stmnt_record[index].line_ids, bank_stmnt_line_dict)

    def confirm_bank_statement(self, statement):
        for line in statement.line_ids:
            wizard = self.env['bank.rec.widget'].with_context(default_st_line_id=line.id).new({})
            auto_balance_line = wizard.line_ids.filtered(lambda x: x.flag == 'auto_balance')
            form = WizardForm(wizard)
            form._view['modifiers']['todo_command']['invisible'] = False
            form.todo_command = f'mount_line_in_edit,{auto_balance_line.index}'
            form.form_name = "toto"
            form.form_account_id = self.account
            wizard = form.save()
            wizard.button_validate(async_action=False)
        if statement.state == 'open':
            statement.button_post()
        statement.button_validate()
        return statement

    # Tests
    def test_creation_initial_sync_statement(self):
        transactions = self.create_transactions(['2016-01-01', '2016-01-03'])
        self.online_account.balance = 1000
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        # Since ending balance is 1000$ and we only have 20$ of transactions and that it is the first statement
        # it should create a statement before this one with the initial statement line
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 2, 'Should have created an initial bank statement and one for the synchronization')
        # Since a statement already exists, next transactions should not create an initial statement even if ending_balance
        # is greater than the sum of transactions
        transactions = self.create_transactions(['2016-01-05'])
        self.online_account.balance = 2000
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 980.0,
                    'date': fields.Date.from_string('2015-12-31'),
                    'line_ids': [{'amount': 980.0}]
                },
                {
                    'balance_start': 980.0,
                    'balance_end_real': 1000.0,
                    'date': fields.Date.from_string('2016-01-03'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'balance_start': 1000.0,
                    'balance_end_real': 2000.0,
                    'date': fields.Date.from_string('2016-01-05'),
                    'line_ids': [{'amount': 10.0}]
                },
            ]
        )

    def test_creation_initial_sync_statement_bis(self):
        transactions = self.create_transactions(['2016-01-01', '2016-01-03'])
        self.online_account.balance = 20
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        # Since ending balance is 20$ and we only have 20$ of transactions and that it is the first statement
        # it should NOT create a initial statement before this one
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [{
                'balance_start': 0.0,
                'balance_end_real': 20.0,
                'date': fields.Date.from_string('2016-01-03'),
                'line_ids': [
                    {'amount': 10.0},
                    {'amount': 10.0}
                ]
            }]
        )
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 2, 'Should have two lines')

    def test_creation_initial_sync_statement_invert_sign(self):
        transactions = self.create_transactions(['2016-01-01', '2016-01-03'])
        self.online_account.balance = -20
        self.online_account.inverse_transaction_sign = True
        self.online_account.inverse_balance_sign = True
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        # Since ending balance is 1000$ and we only have 20$ of transactions and that it is the first statement
        # it should create a statement before this one with the initial statement line
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 1, 'Should have created one bank statement for the synchronization')
        # Since a statement already exists, next transactions should not create an initial statement even if ending_balance
        # is greater than the sum of transactions
        transactions = self.create_transactions(['2016-01-05'])
        self.online_account.balance = -30
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': -20.0,
                    'date': fields.Date.from_string('2016-01-03'),
                    'line_ids': [
                        {'amount': -10.0},
                        {'amount': -10.0}
                    ]
                },
                {
                    'balance_start': -20.0,
                    'balance_end_real': -30.0,
                    'date': fields.Date.from_string('2016-01-05'),
                    'line_ids': [{'amount': -10.0}]
                },
            ]
        )

    def test_creation_every_sync(self):
        self.bank_journal.write({'bank_statement_creation_groupby': 'none'})
        # Create one statement with 2 lines
        transactions = self.create_transactions(['2016-01-01', '2016-01-03'])
        self.online_account.balance = 20
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        # Create another statement with 2 lines
        transactions = self.create_transactions(['2016-01-02', '2016-01-05'])
        self.online_account.balance = 40
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'name': 'BNKon Statement 2016/01/00001',
                    'balance_start': 0.0,
                    'balance_end_real': 20.0,
                    'date': fields.Date.from_string('2016-01-03'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'name': 'BNKon Statement 2016/01/00002',
                    'balance_start': 20.0,
                    'balance_end_real': 40.0,
                    'date': fields.Date.from_string('2016-01-05'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                }
            ]
        )

        # If we create a statement with a transactions max date in the past, it will be created in the past
        # Also the account balance will be set on the last statement
        transactions = self.create_transactions(['2016-01-04'])
        self.online_account.balance = 70
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 20.0,
                    'date': fields.Date.from_string('2016-01-03'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'balance_start': 20.0,
                    'balance_end_real': 30.0,
                    'date': fields.Date.from_string('2016-01-04'),
                    'line_ids': [{'amount': 10.0}]
                },
                {
                    'balance_start': 30.0,
                    'balance_end_real': 70.0,
                    'date': fields.Date.from_string('2016-01-05'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                }
            ]
        )
        # If we create a statement with a transactions max date in the past, and that a statement at that date
        # already exists, it will be added to that statement
        transactions = self.create_transactions(['2016-01-04', '2016-01-04'])
        self.online_account.balance = 70
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 20.0,
                    'date': fields.Date.from_string('2016-01-03'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'balance_start': 20.0,
                    'balance_end_real': 50.0,
                    'date': fields.Date.from_string('2016-01-04'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'balance_start': 50.0,
                    'balance_end_real': 70.0,
                    'date': fields.Date.from_string('2016-01-05'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                }
            ]
        )

    def test_creation_every_day(self):
        self.bank_journal.write({'bank_statement_creation_groupby': 'day'})
        transactions = self.create_transactions(['2016-01-10', '2016-01-15'])
        # first synchronization, no previous bank statement
        self.online_account.balance = 20
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 10.0,
                    'date': fields.Date.from_string('2016-01-10'),
                    'line_ids': [{'amount': 10.0}]
                },
                {
                    'balance_start': 10.0,
                    'balance_end_real': 20.0,
                    'date': fields.Date.from_string('2016-01-15'),
                    'line_ids': [{'amount': 10.0}]
                }
            ]
        )

        # Fetch new transactions, two will be added to already existing statement, two will create new statements in between
        # and one will create new statements afterwards
        transactions = self.create_transactions(['2016-01-10', '2016-01-10', '2016-01-12', '2016-01-13', '2016-01-16'])
        self.online_account.balance = 70
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 30.0,
                    'date': fields.Date.from_string('2016-01-10'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'balance_start': 30.0,
                    'balance_end_real': 40.0,
                    'date': fields.Date.from_string('2016-01-12'),
                    'line_ids': [{'amount': 10.0}]
                },
                {
                    'balance_start': 40.0,
                    'balance_end_real': 50.0,
                    'date': fields.Date.from_string('2016-01-13'),
                    'line_ids': [{'amount': 10.0}]
                },
                {
                    'balance_start': 50.0,
                    'balance_end_real': 60.0,
                    'date': fields.Date.from_string('2016-01-15'),
                    'line_ids': [{'amount': 10.0}]
                },
                {
                    'balance_start': 60.0,
                    'balance_end_real': 70.0,
                    'date': fields.Date.from_string('2016-01-16'),
                    'line_ids': [{'amount': 10.0}]
                }
            ]
        )

        # Post first statement and then try adding new transaction to it, create a new statement at the same date and add the transaction to it
        self.confirm_bank_statement(created_bnk_stmt[0])
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc', limit=1)
        self.assertEqual(created_bnk_stmt.state, 'confirm', 'Statement should be posted')

        transactions = self.create_transactions(['2016-01-10'])
        self.online_account.balance = 80
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc, balance_start asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 30.0,
                    'date': fields.Date.from_string('2016-01-10'),
                    'state': 'confirm',
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0},
                        {'amount': 10.0},
                    ]
                },
                {
                    'balance_start': 30.0,
                    'balance_end_real': 40.0,
                    'date': fields.Date.from_string('2016-01-10'),
                    'line_ids': [
                        {'amount': 10.0},
                    ]
                },
                {
                    'balance_start': 40.0,
                    'balance_end_real': 50.0,
                    'date': fields.Date.from_string('2016-01-12'),
                    'line_ids': [{'amount': 10.0}]
                },
                {
                    'balance_start': 50.0,
                    'balance_end_real': 60.0,
                    'date': fields.Date.from_string('2016-01-13'),
                    'line_ids': [{'amount': 10.0}]
                },
                {
                    'balance_start': 60.0,
                    'balance_end_real': 70.0,
                    'date': fields.Date.from_string('2016-01-15'),
                    'line_ids': [{'amount': 10.0}]
                },
                {
                    'balance_start': 70.0,
                    'balance_end_real': 80.0,
                    'date': fields.Date.from_string('2016-01-16'),
                    'line_ids': [{'amount': 10.0}]
                }
            ]
        )

    def test_creation_every_week(self):
        self.bank_journal.write({'bank_statement_creation_groupby': 'week'})
        transactions = self.create_transactions(['2016-01-10', '2016-01-15'])
        # first synchronization, no previous bank statement
        self.online_account.balance = 20
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 10.0,
                    'date': fields.Date.from_string('2016-01-04'),
                    'line_ids': [{'amount': 10.0}]
                },
                {
                    'balance_start': 10.0,
                    'balance_end_real': 20.0,
                    'date': fields.Date.from_string('2016-01-11'),
                    'line_ids': [{'amount': 10.0}]
                }
            ]
        )

        # Add new transactions, 2 should be in first statement, one in second statement and one newly created
        transactions = self.create_transactions(['2016-01-08', '2016-01-04', '2016-01-13', '2016-01-18'])
        self.online_account.balance = 60
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 30.0,
                    'date': fields.Date.from_string('2016-01-04'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'balance_start': 30.0,
                    'balance_end_real': 50.0,
                    'date': fields.Date.from_string('2016-01-11'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'balance_start': 50.0,
                    'balance_end_real': 60.0,
                    'date': fields.Date.from_string('2016-01-18'),
                    'line_ids': [{'amount': 10.0}]
                }
            ]
        )

    def test_creation_every_2weeks(self):
        self.bank_journal.write({'bank_statement_creation_groupby': 'bimonthly'})

        transactions = self.create_transactions(['2016-01-10', '2016-01-15'])
        # first synchronization, no previous bank statement
        self.online_account.balance = 20
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 10.0,
                    'date': fields.Date.from_string('2016-01-01'),
                    'line_ids': [{'amount': 10.0}]
                },
                {
                    'balance_start': 10.0,
                    'balance_end_real': 20.0,
                    'date': fields.Date.from_string('2016-01-15'),
                    'line_ids': [{'amount': 10.0}]
                }
            ]
        )

        # Add new transactions, 2 should be in first statement, one in second statement and one newly created
        transactions = self.create_transactions(['2016-01-08', '2016-01-04', '2016-01-18', '2016-02-01'])
        self.online_account.balance = 60
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 30.0,
                    'date': fields.Date.from_string('2016-01-01'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'balance_start': 30.0,
                    'balance_end_real': 50.0,
                    'date': fields.Date.from_string('2016-01-15'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'balance_start': 50.0,
                    'balance_end_real': 60.0,
                    'date': fields.Date.from_string('2016-02-01'),
                    'line_ids': [{'amount': 10.0}]
                }
            ]
        )

    def test_creation_every_month(self):
        self.bank_journal.write({'bank_statement_creation_groupby': 'month'})

        transactions = self.create_transactions(['2016-01-10', '2016-02-15'])
        # first synchronization, no previous bank statement
        self.online_account.balance = 20
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 10.0,
                    'date': fields.Date.from_string('2016-01-01'),
                    'line_ids': [{'amount': 10.0}]
                },
                {
                    'balance_start': 10.0,
                    'balance_end_real': 20.0,
                    'date': fields.Date.from_string('2016-02-01'),
                    'line_ids': [{'amount': 10.0}]
                }
            ]
        )

        # Add new transactions, 2 should be in first statement, one in second statement and one newly created
        transactions = self.create_transactions(['2016-01-08', '2016-01-04', '2016-02-01', '2016-03-18'])
        self.online_account.balance = 60
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertBankStatementValues(
            created_bnk_stmt,
            [
                {
                    'balance_start': 0.0,
                    'balance_end_real': 30.0,
                    'date': fields.Date.from_string('2016-01-01'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'balance_start': 30.0,
                    'balance_end_real': 50.0,
                    'date': fields.Date.from_string('2016-02-01'),
                    'line_ids': [
                        {'amount': 10.0},
                        {'amount': 10.0}
                    ]
                },
                {
                    'balance_start': 50.0,
                    'balance_end_real': 60.0,
                    'date': fields.Date.from_string('2016-03-01'),
                    'line_ids': [{'amount': 10.0}]
                }
            ]
        )

    def test_assign_partner_auto_bank_stmt(self):
        self.bank_journal.write({'bank_statement_creation_groupby': 'day'})
        agrolait = self.env['res.partner'].create({'name': 'A partner'})
        self.assertEqual(agrolait.online_partner_information, False)
        transactions = self.create_transaction_partner(date='2016-01-01', partner_info='test_vendor_name')
        self.online_account.balance = 50
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date desc', limit=1)
        # Ensure that bank statement has no partner set
        self.assertEqual(created_bnk_stmt.line_ids[0].partner_id, self.env['res.partner'])
        # Assign partner and Validate bank statement
        created_bnk_stmt.line_ids[0].write({'partner_id': agrolait.id})
        # process the bank statement line
        self.confirm_bank_statement(created_bnk_stmt)
        # Check that partner has correct vendor_name associated to it
        self.assertEqual(agrolait.online_partner_information, 'test_vendor_name')

        # Create another statement with a partner
        transactions = self.create_transaction_partner(date='2016-01-02', partner_id=agrolait.id, partner_info='test_other_vendor_name')
        self.online_account.balance = 100
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date desc', limit=1)
        # Ensure that statement has a partner set
        self.assertEqual(created_bnk_stmt.line_ids[0].partner_id, agrolait)
        # Validate and check that partner has no vendor_information set
        self.confirm_bank_statement(created_bnk_stmt)
        self.assertEqual(agrolait.online_partner_information, False)

        # Create another statement with same information
        transactions = self.create_transaction_partner(date='2016-01-03', partner_id=agrolait.id)
        self.online_account.balance = 150
        self.bnk_stmt._online_sync_bank_statement(transactions, self.online_account)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date desc', limit=1)
        # Ensure that statement has a partner set
        self.assertEqual(created_bnk_stmt.line_ids[0].partner_id, agrolait)
        # Validate and check that partner has no vendor_name set
        self.confirm_bank_statement(created_bnk_stmt)
        self.assertEqual(agrolait.online_partner_information, False)

    def test_automatic_journal_assignment(self):
        def create_online_account(name, link_id, iban, currency_id):
            return self.env['account.online.account'].create({
                'name': name,
                'account_online_link_id': link_id,
                'account_number': iban,
                'currency_id' : currency_id,
            })

        def create_bank_account(account_number, partner_id):
            return self.env['res.partner.bank'].create({
                'acc_number': account_number,
                'partner_id': partner_id,
            })

        def create_journal(name, journal_type, code, currency_id=False, bank_account_id=False):
            return self.env['account.journal'].create({
                'name': name,
                'type': journal_type,
                'code': code,
                'currency_id': currency_id,
                'bank_account_id': bank_account_id,
                'bank_statement_creation_groupby': 'none',
            })

        eur_currency = self.env.ref('base.EUR')
        bank_account_1 = create_bank_account('BE48485444456727', self.company_data['company'].partner_id.id)
        bank_account_2 = create_bank_account('Coucou--.BE619-.--5-----4856342317yocestmoi-', self.company_data['company'].partner_id.id)
        bank_account_3 = create_bank_account('BE23798242487491', self.company_data['company'].partner_id.id)

        bank_journal_with_account_eur = create_journal('Bank with account', 'bank', 'BJWA1', eur_currency.id, bank_account_1.id)
        bank_journal_with_badly_written_account_eur = create_journal('Bank with errors in account name', 'bank', 'BJWA2', eur_currency.id, bank_account_2.id)
        bank_journal_with_account_usd = create_journal('Bank with account USD', 'bank', 'BJWA3', self.env.ref('base.USD').id, bank_account_3.id)
        bank_journal_simple = create_journal('Bank without account and currency', 'bank', 'BJWOA2')

        online_account_1 = create_online_account('OnlineAccount1', self.link_account.id, 'BE48485444456727', eur_currency.id)
        online_account_2 = create_online_account('OnlineAccount2', self.link_account.id, 'BE61954856342317', eur_currency.id)
        online_account_3 = create_online_account('OnlineAccount3', self.link_account.id, 'BE23798242487491', eur_currency.id)
        online_account_4 = create_online_account('OnlineAccount4', self.link_account.id, 'BE31812561129155', eur_currency.id)
        online_accounts = [online_account_1, online_account_2, online_account_3, online_account_4]

        account_link_journal_wizard = self.env['account.link.journal'].create({
            'number_added': len(online_accounts),
            'account_ids': [Command.create({
                'online_account_id': online_account.id,
                'journal_id': online_account.journal_ids[0].id if online_account.journal_ids else None
            }) for online_account in online_accounts]
        })
        with patch('odoo.addons.account_online_synchronization.models.account_online.AccountOnlineLink.action_fetch_transactions', return_value=True):
            account_link_journal_wizard.sync_now()

        self.assertEqual(online_account_1.id, bank_journal_with_account_eur.account_online_account_id.id, "The wizard should have linked the first online account to the journal with the same account.")
        self.assertEqual(online_account_2.id, bank_journal_with_badly_written_account_eur.account_online_account_id.id, "The wizard should have linked the second online account to the journal with the same account, after sanitization.")
        self.assertNotEqual(online_account_3.id, bank_journal_with_account_usd.account_online_account_id.id, "As the currency in the journal is different than the one specified in the online account, they should not be linked to each other.")
        self.assertEqual(online_account_3.id, bank_journal_simple.account_online_account_id.id, "The next empty journal should be linked to the online account, when no journal exists with the corresponding currency and account number.")
        previously_created_journals = [bank_journal_with_account_eur, bank_journal_with_badly_written_account_eur, bank_journal_with_account_usd, bank_journal_simple, self.bank_journal]
        self.assertTrue(online_account_4.journal_ids and online_account_4.journal_ids[0] not in previously_created_journals, "A new journal should be created for the remaining online account.")
