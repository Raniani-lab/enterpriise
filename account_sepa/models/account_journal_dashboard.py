# -*- coding: utf-8 -*-

from odoo import models, api, _

class account_journal(models.Model):
    _inherit = "account.journal"

    def get_journal_dashboard_datas(self):
        domain_sepa_ct_to_send = [
            ('journal_id', '=', self.id),
            ('payment_method_line_id.code', '=', 'sepa_ct'),
            ('state', '=', 'posted'),
            ('is_move_sent', '=', False),
            ('is_matched', '=', False),
        ]
        return dict(
            super(account_journal, self).get_journal_dashboard_datas(),
            num_sepa_ct_to_send=self.env['account.payment'].search_count(domain_sepa_ct_to_send)
        )

    def action_sepa_ct_to_send(self):
        payment_method_line = self.outbound_payment_method_line_ids.filtered(lambda l: l.code == 'sepa_ct')
        list_view_id = self.env.ref('account_batch_payment.view_account_payment_tree_inherit_account_batch_payment').id
        return {
            'name': _('SEPA Credit Transfers to Send'),
            'type': 'ir.actions.act_window',
            'view_mode': 'list,form,graph',
            'res_model': 'account.payment',
            'domain': [
                ('payment_method_line_id.code', '=', 'sepa_ct'),
                ('state', '=', 'posted'),
                ('is_move_sent', '=', False),
                ('is_matched', '=', False),
            ],
            'views': [[list_view_id, 'list'], [False, 'form'], [False, 'graph']],
            'context': dict(
                self.env.context,
                search_default_journal_id=self.id,
                search_default_outbound_filter=True,
                default_payment_method_line_id=payment_method_line.id,
            ),
        }
