# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import date, datetime
import calendar
import time

from unittest.mock import patch

from odoo.tests import common
from odoo.tools.misc import formatLang
from odoo import fields


class TestAccountReports(common.TransactionCase):

    def setUp(self):
        super().setUp()
        self.company = self.env.user.company_id
        self.partner_timmy_thomas = self.env['res.partner'].create({
            'name': 'Timmy Thomas',
        })
        self.account_type_other = self.env['account.account.type'].create({
            'name': 'other',
            'type': 'other',
        })
        #  Account types
        self.account_type_rcv = self.env['account.account.type'].create({
            'name': 'receivable',
            'type': 'receivable',
        })
        # Accounts
        self.account_rcv = self.env['account.account'].create({
            'name': 'RCV',
            'code': '001',
            'user_type_id': self.account_type_rcv.id,
            'reconcile': True,
            'company_id': self.company.id,
        })
        self.account_sale = self.env['account.account'].create({
            'name': 'SALE',
            'code': '002',
            'user_type_id': self.account_type_other.id,
            'reconcile': False,
            'company_id': self.company.id,
        })
        self.sale_journal = self.env['account.journal'].create({
            'name': 'sale',
            'code': 'SALE',
            'type': 'sale',
            'company_id': self.company.id,
            'default_debit_account_id': self.account_sale.id,
            'default_credit_account_id': self.account_sale.id,
        })
        mock_date = time.strftime('%Y') + '-06-26'
        self.minimal_options = {
            'date': {
                'date_from': mock_date,
                'date_to': mock_date,
            },
            'ir_filters': [],
        }

    def test_05_apply_date_filter(self):
        def patched_today(*args, **kwargs):
            return fields.Date.to_date('2018-12-11')

        with patch.object(fields.Date, 'context_today', patched_today):
            # Init options.
            report = self.env['account.report']
            report.filter_date = {
                'filter': 'last_month',
                'mode': 'range',
            }
            options = report._get_options(None)

            self.assertEqual(options['date']['date_from'], '2018-11-01')
            self.assertEqual(options['date']['date_to'], '2018-11-30')

    def test_06_apply_date_filter_with_timezone(self):
        self.env.user.tz = 'America/Mexico_City'
        original_context_today = fields.Date.context_today

        def patched_today(*args, **kwargs):
            timestamp = datetime(2019, 1, 1, 2, 0, 0)
            return original_context_today(self.env.user, timestamp)

        with patch.object(fields.Date, 'context_today', patched_today):
            # Init options.
            report = self.env['account.report']
            report.filter_date = {
                'filter': 'last_month',
                'mode': 'single',
            }
            options = report._get_options(None)

            today = fields.Date.to_date('2018-12-31')
            fiscal_date_to = self.env.user.company_id.compute_fiscalyear_dates(today)['date_to']

            target_day = calendar.monthrange(fiscal_date_to.year, fiscal_date_to.month - 1)[1]

            # New date in option should really be the month before
            expected_date = date(year=fiscal_date_to.year, month=fiscal_date_to.month - 1, day=target_day)
            expected_date = fields.Date.to_string(expected_date)

            self.assertEqual(options['date']['date_to'], expected_date)

    def test_05_followup_multicompany(self):
        year = time.strftime('%Y')
        date_sale = year + '-06-26'

        # Company 0
        invoice_move = self.env['account.move'].create({
            'name': 'Invoice Move',
            'date': date_sale,
            'journal_id': self.sale_journal.id,
            'company_id': self.company.id,
        })

        sale_move_lines = self.env['account.move.line'].with_context(check_move_validity=False)
        sale_move_lines |= sale_move_lines.create({
            'name': 'receivable line',
            'account_id': self.account_rcv.id,
            'debit': 30.0,
            'move_id': invoice_move.id,
            'partner_id': self.partner_timmy_thomas.id,
        })
        sale_move_lines |= sale_move_lines.create({
            'name': 'product line',
            'account_id': self.account_sale.id,
            'credit': 30.0,
            'move_id': invoice_move.id,
            'partner_id': self.partner_timmy_thomas.id,
        })

        # Company 1
        company1 = self.env['res.company'].create({'name': 'company1'})
        self.env.user.write({
            'company_ids': [(4, company1.id, False)],
        })

        account_sale1 = self.account_sale.copy({'company_id': company1.id})
        sale_journal1 = self.sale_journal.copy({
            'company_id': company1.id,
            'default_debit_account_id': account_sale1.id,
            'default_credit_account_id': account_sale1.id,
        })
        account_rcv1 = self.account_rcv.copy({'company_id': company1.id})

        invoice_move1 = self.env['account.move'].create({
            'name': 'Invoice Move',
            'date': date_sale,
            'journal_id': sale_journal1.id,
            'company_id': company1.id,
        })

        sale_move_lines.create({
            'name': 'receivable line',
            'account_id': account_rcv1.id,
            'debit': 60.0,
            'move_id': invoice_move1.id,
            'partner_id': self.partner_timmy_thomas.id,
        })
        sale_move_lines.create({
            'name': 'product line',
            'account_id': account_sale1.id,
            'credit': 60.0,
            'move_id': invoice_move1.id,
            'partner_id': self.partner_timmy_thomas.id,
        })

        invoice_move.post()
        invoice_move1.post()

        # For company 0
        self.env.user.company_id = self.company
        currency = self.company.currency_id
        self.assertEqual(self.partner_timmy_thomas.credit, 30.0)

        options = dict(self.minimal_options)
        options['partner_id'] = self.partner_timmy_thomas.id

        lines = self.env['account.followup.report']._get_lines(options)

        # Title line + actual business line
        self.assertEqual(len(lines), 2)
        self.assertEqual(lines[1]['class'], 'total')
        self.assertEqual(len(lines[1]['columns']), 7)

        self.assertEqual(lines[1]['columns'][5]['name'], 'Total Due')
        self.assertEqual(lines[1]['columns'][6]['name'], formatLang(self.env, 30.00, currency_obj=currency))

        # For company 1
        self.env.user.company_id = company1
        currency = company1.currency_id
        self.env.cache.invalidate()
        self.assertEqual(self.partner_timmy_thomas.credit, 60.0)

        lines = self.env['account.followup.report']._get_lines(options)

        # Title line + actual business line
        self.assertEqual(len(lines), 2)
        self.assertEqual(lines[1]['class'], 'total')
        self.assertEqual(len(lines[1]['columns']), 7)

        self.assertEqual(lines[1]['columns'][5]['name'], 'Total Due')
        self.assertEqual(lines[1]['columns'][6]['name'], formatLang(self.env, 60.00, currency_obj=currency))
