# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# Copyright (c) 2012 Noviat nv/sa (www.noviat.be). All rights reserved.
import base64

from odoo.addons.account.tests.common import AccountTestCommon
from odoo.modules.module import get_module_resource
from odoo.tests import tagged
from odoo.tools import float_compare


@tagged('post_install', '-at_install')
class TestCodaFile(AccountTestCommon):
    """Tests for import bank statement coda file format (account.bank.statement.import)
    """

    @classmethod
    def setUpClass(cls):
        super(TestCodaFile, cls).setUpClass()

        cls.statement_import_model = cls.env['account.bank.statement.import']
        cls.bank_statement_model = cls.env['account.bank.statement']
        coda_file_path = get_module_resource('l10n_be_coda', 'test_coda_file', 'Ontvangen_CODA.2013-01-11-18.59.15.txt')
        cls.coda_file = base64.b64encode(open(coda_file_path, 'rb').read())
        cls.bank_journal.currency_id = cls.env['res.currency'].search([('name', '=', 'EUR')], limit=1).id
        cls.context = {
            'journal_id': cls.bank_journal.id
        }
        cls.bank_statement = cls.statement_import_model.create({'attachment_ids': [(0, 0, {
            'name': 'test file',
            'datas': cls.coda_file,
        })]
        })

    def test_coda_file_import(self):
        self.bank_statement.with_context(self.context).import_file()
        bank_st_record = self.bank_statement_model.search([('name', '=', '135')], limit=1)
        self.assertEqual(float_compare(bank_st_record.balance_start, 11812.70, precision_digits=2), 0)
        self.assertEqual(float_compare(bank_st_record.balance_end_real, 13646.05, precision_digits=2), 0)

    def test_coda_file_import_twice(self):
        self.bank_statement.with_context(self.context).import_file()
        with self.assertRaises(Exception):
            self.statement_import_model.with_context(self.context).import_file([self.bank_statement_id])

    def test_coda_file_wrong_journal(self):
        """ The demo account used by the CODA file is linked to the demo bank_journal """
        bank_statement_id = self.statement_import_model.create({'attachment_ids': [(0, 0, {
            'name': 'test file',
            'datas': self.coda_file,
        })]
        })
        self.context['journal_id'] = self.miscellaneous_journal.id
        with self.assertRaises(Exception):
            self.statement_import_model.with_context(self.context).import_file([bank_statement_id])
