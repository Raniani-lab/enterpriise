from odoo import models


class SaleSubscription(models.Model):
    _inherit = "sale.order"

    def _create_recurring_invoice(self, batch_size=30):
        invoices = super()._create_recurring_invoice(batch_size)
        # Already compute taxes for unvalidated documents as they can already be paid
        invoices.filtered(lambda m: m.state == 'draft').button_update_avatax()
        return invoices

    def _do_payment(self, payment_token, invoice, auto_commit=False):
        invoice.button_update_avatax()
        return super()._do_payment(payment_token, invoice, auto_commit=auto_commit)

    def _create_invoices(self, grouped=False, final=False, date=None):
        moves = super()._create_invoices(grouped=grouped, final=final, date=date)
        moves.filtered(lambda m: m.state == 'draft').button_update_avatax()
        return moves
