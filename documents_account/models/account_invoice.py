# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.osv import expression


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'

    reconciliation_move_line_id = fields.Many2one('account.move.line', string='Reconciliation Journal Entry Line')

    @api.multi
    def _get_domain_edition_mode_available(self):
        domain = super(AccountInvoice, self)._get_domain_edition_mode_available()
        return expression.OR([
            domain,
            [('reconciliation_invoice_id', '=', self.id)]
        ])

    @api.multi
    def action_reconcile_to_check(self, params):
        action = super(AccountInvoice, self).action_reconcile_to_check(params)
        line = self.reconciliation_move_line_id
        if line:
            if not line.partner_id:
                line.partner_id = self.partner_id
            action['context']['statement_line_ids'] = [line.statement_line_id.id]

        return action
