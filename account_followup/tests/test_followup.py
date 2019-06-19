# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import tagged
from odoo.tools.misc import formatLang
import time
from odoo import fields
from odoo.addons.account_reports.tests.common import TestAccountReportsCommon, TestAccountReportsCommon2


class TestAccountFollowup(TestAccountReportsCommon2):

    def test_05_followup_multicompany(self):
        date_sale = fields.Date.today()

        # Company 0
        invoice_move = self.env['account.move'].with_context(default_type='out_invoice').create({
            'partner_id': self.partner_timmy_thomas.id,
            'date': date_sale,
            'journal_id': self.sale_journal.id,
            'invoice_line_ids': [
                (0, 0, {'quantity': 1, 'price_unit': 30}),
            ],
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

        invoice_move1 = self.env['account.move'].with_context(default_type='out_invoice').create({
            'partner_id': self.partner_timmy_thomas.id,
            'date': date_sale,
            'journal_id': sale_journal1.id,
            'invoice_line_ids': [
                (0, 0, {'quantity': 1, 'price_unit': 60}),
            ],
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


@tagged('post_install', '-at_install')
class TestAccountFollowupReports(TestAccountReportsCommon):
    @classmethod
    def setUpClass(cls):
        super(TestAccountFollowupReports, cls).setUpClass()
        cls.env['account_followup.followup.line'].search([]).unlink()
        cls.first_followup_level = cls.env['account_followup.followup.line'].create({
            'name': 'first_followup_level',
            'delay': 10,
            'description': 'First Followup Level',
        })
        cls.second_followup_level = cls.env['account_followup.followup.line'].create({
            'name': 'second_followup_level',
            'delay': 20,
            'description': 'Second Followup Level',
        })

        cls.partner_a.write({
            'email': 'partner_a@mypartners.xyz',
        })

    def test_followup_report_initial_state(self):
        ''' Test folded/unfolded lines. '''
        # Init options.
        report = self.env['account.followup.report']
        options = report._get_options(None)
        options['partner_id'] = self.partner_a.id
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                    Date,           Due Date,       Doc.    Comm.                Exp. Date   Blocked             Total Due
            [   0,                                      1,              2,              3,      4,                   5,          6,                  7],
            [
                ('INV/2017/0001',                       '01/01/2017',   '01/01/2017',   '',     'INV/2017/0001',     '',         '',                 115.00),
                ('INV/2016/0001',                       '12/01/2016',   '12/01/2016',   '',     'INV/2016/0001',     '',         '',                 780.00),
                ('',                                    '',             '',             '',     '',                  '',         'Total Due',        895.00),
                ('',                                    '',             '',             '',     '',                  '',         'Total Overdue',    895.00),
            ],
        )

    def test_next_followup_date(self):
        self.assertFalse(self.partner_a.payment_next_action_date)
        self.assertEqual(self.partner_a.followup_status, 'in_need_of_action')
        self.assertEqual(self.partner_a.followup_level, self.first_followup_level)

        self.env['account.followup.report'].execute_followup(self.partner_a)
        self.assertEqual(self.partner_a.followup_level, self.second_followup_level)
        self.assertEqual(self.partner_a.followup_status, 'in_need_of_action')

        self.env['account.followup.report'].execute_followup(self.partner_a)
        self.assertEqual(self.partner_a.followup_level, self.second_followup_level)
        self.assertEqual(self.partner_a.followup_status, 'no_action_needed')
