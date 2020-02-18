# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import odoo
from odoo.exceptions import UserError, AccessError
from odoo.tests import Form
from odoo.tools import float_compare

from odoo.addons.sale.tests.test_sale_common import TestCommonSaleNoChart


class TestSaleOrder(TestCommonSaleNoChart):

    @classmethod
    def setUpClass(cls):
        super(TestSaleOrder, cls).setUpClass()
        # set up users
        cls.setUpUsers()
        # set up accounts and products and journals
        cls.setUpAdditionalAccounts()
        cls.setUpClassicProducts()
        cls.setUpAccountJournal()

    def test_reconciliation_with_so(self):
        # create SO
        so = self.env['sale.order'].create({
            'name': 'SO/01/01',
            'reference': 'Petit suisse',
            'partner_id': self.partner_customer_usd.id,
            'partner_invoice_id': self.partner_customer_usd.id,
            'partner_shipping_id': self.partner_customer_usd.id,
            'pricelist_id': self.pricelist_usd.id,
        })
        self.env['sale.order.line'].create({
            'name': self.product_order.name,
            'product_id': self.product_order.id,
            'product_uom_qty': 2,
            'product_uom': self.product_order.uom_id.id,
            'price_unit': self.product_order.list_price,
            'order_id': so.id,
            'tax_id': False,
        })
        # Mark SO as sent otherwise we won't find any match
        so.write({'state': 'sent'})
        # Create bank statement
        statement = self.env['account.bank.statement'].create({
            'name': 'Test',
            'journal_id': self.journal_bank.id,
            'user_id': self.user_employee.id,
        })
        st_line1 = self.env['account.bank.statement.line'].create({
            'payment_ref': 'should not find anything',
            'amount': 15,
            'statement_id': statement.id
        })
        st_line2 = self.env['account.bank.statement.line'].create({
            'payment_ref': 'Payment for SO/01/01',
            'amount': 15,
            'statement_id': statement.id
        })
        st_line3 = self.env['account.bank.statement.line'].create({
            'payment_ref': 'Payment for Petit suisse',
            'amount': 15,
            'statement_id': statement.id
        })
        # Call get_bank_statement_line_data for st_line_1, should not find any sale order
        res = self.env['account.reconciliation.widget'].get_bank_statement_line_data([st_line1.id])
        line = res.get('lines', [{}])[0]
        self.assertFalse(line.get('sale_order_ids', False))
        # Call again for st_line_2, it should find sale_order
        res = self.env['account.reconciliation.widget'].get_bank_statement_line_data([st_line2.id])
        line = res.get('lines', [{}])[0]
        self.assertEqual(line.get('sale_order_ids', []), [so.id])
        # Call again for st_line_3, it should find sale_order based on reference
        res = self.env['account.reconciliation.widget'].get_bank_statement_line_data([st_line3.id])
        line = res.get('lines', [{}])[0]
        self.assertEqual(line.get('sale_order_ids', []), [so.id])
