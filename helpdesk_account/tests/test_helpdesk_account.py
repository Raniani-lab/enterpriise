# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.helpdesk.tests import common
from odoo.tests.common import Form


class TestHelpdeskAccount(common.HelpdeskTransactionCase):
    """ Test used to check that the functionalities of After sale in Helpdesk (credit note).
    """

    def test_helpdesk_account_1(self):
        # give the test team ability to create credit note
        self.test_team.use_credit_notes = True
        # create a sale order and invoice
        partner = self.env['res.partner'].create({
            'name': 'Customer Credee'
        })
        product = self.env['product.product'].create({
            'name': 'product 1',
            'type': 'product',
        })
        so = self.env['sale.order'].create({
            'partner_id': partner.id,
        })
        self.env['sale.order.line'].create({
            'product_id': product.id,
            'price_unit': 10,
            'product_uom_qty': 1,
            'order_id': so.id,
        })
        so.action_confirm()
        so._create_invoices()
        invoice = so.invoice_ids
        invoice.invoice_validate()
        # helpdesk.ticket access rights
        ticket = self.env['helpdesk.ticket'].create({
            'name': 'test',
            'partner_id': partner.id,
            'team_id': self.test_team.id,
            'sale_order_id': so.id,
        })

        credit_note_form = Form(self.env['account.invoice.refund'].with_context({
            'active_model': 'helpdesk.ticket',
            'default_ticket_id': ticket.id,
        }))
        credit_note_form.invoice_id = so.invoice_ids
        credit_note_form.description = 'test'
        credit_note = credit_note_form.save()
        credit_note.invoice_refund()
        refund = self.env['account.invoice'].search([
            ('type', '=', 'out_refund'),
            ('refund_invoice_id', '=', invoice.id)
        ])

        self.assertEqual(len(refund), 1, "No refund created")
        self.assertEqual(refund.state, 'draft', "Wrong status of the refund")
        self.assertEqual(refund.name, 'test', "The reference is wrong")
        self.assertEqual(ticket.invoices_count, 1,
            "The ticket should be linked to a credit note")
        self.assertEqual(refund[0].id, ticket.invoice_ids[0].id,
            "The correct credit note should be referenced in the ticket")
