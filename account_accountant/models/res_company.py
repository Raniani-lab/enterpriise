# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields

class ResCompany(models.Model):
    _inherit = 'res.company'

    invoicing_switch_threshold = fields.Date(string="Invoicing Switch Threshold", help="Every payment and invoice before this date will receive the 'From Invoicing' status, hiding all the accounting entries related to it. Use this option after installing Accounting if you were using only Invoicing before, before importing all your actual accounting data in to Odoo.")

    def write(self, vals):
        old_threshold_vals = {}
        for record in self:
            old_threshold_vals[record] = record.invoicing_switch_threshold

        rslt = super(ResCompany, self).write(vals)

        for record in self:
            if 'invoicing_switch_threshold' in vals and old_threshold_vals[record] != vals['invoicing_switch_threshold']:
                if record.invoicing_switch_threshold:
                    # If a new date was set as threshold, we switch all the
                    # posted moves and payments before it to 'invoicing_legacy'.
                    # We also reset to posted all the moves and payments that
                    # were 'invoicing_legacy' and were posterior to the threshold
                    self.env.cr.execute("""
                        update account_move_line aml
                        set parent_state = 'posted'
                        from account_move move
                        where aml.move_id = move.id
                        and move.payment_state = 'invoicing_legacy'
                        and move.date >= %(switch_threshold)s
                        and move.company_id = %(company_id)s;

                        update account_move
                        set state = 'posted',
                            payment_state = payment_state_before_switch,
                            payment_state_before_switch = null
                        where payment_state = 'invoicing_legacy'
                        and date >= %(switch_threshold)s
                        and company_id = %(company_id)s;

                        update account_move_line aml
                        set parent_state = 'cancel'
                        from account_move move
                        where aml.move_id = move.id
                        and move.state = 'posted'
                        and move.date < %(switch_threshold)s
                        and move.company_id = %(company_id)s;

                        update account_move
                        set state = 'cancel',
                            payment_state_before_switch = payment_state,
                            payment_state = 'invoicing_legacy'
                        where state = 'posted'
                        and date < %(switch_threshold)s
                        and company_id = %(company_id)s;

                        update account_payment
                        set state = state_before_switch,
                            state_before_switch = null
                        from account_journal
                        where state = 'invoicing_legacy'
                        and payment_date >= %(switch_threshold)s
                        and account_journal.id = journal_id
                        and account_journal.company_id = %(company_id)s;

                        update account_payment
                        set state_before_switch = state,
                            state = 'invoicing_legacy'
                        from account_journal
                        where state = 'posted'
                        and payment_date < %(switch_threshold)s
                        and account_journal.id = journal_id
                        and account_journal.company_id = %(company_id)s;
                    """, {'company_id': record.id, 'switch_threshold': record.invoicing_switch_threshold})
                else:
                    # If the threshold date has been emptied, we re-post all the
                    # invoicing_legacy entries.
                    self.env.cr.execute("""
                        update account_move_line aml
                        set parent_state = 'posted'
                        from account_move move
                        where aml.move_id = move.id
                        and move.payment_state = 'invoicing_legacy'
                        and move.company_id = %(company_id)s;

                        update account_move
                        set state = 'posted',
                            payment_state = payment_state_before_switch,
                            payment_state_before_switch = null
                        where payment_state = 'invoicing_legacy'
                        and company_id = %(company_id)s;

                        update account_payment
                        set state = state_before_switch,
                            state_before_switch = null
                        from account_journal
                        where state = 'invoicing_legacy'
                        and account_journal.id = journal_id
                        and account_journal.company_id = %(company_id)s;
                    """, {'company_id': record.id})

                self.env['account.move'].invalidate_cache(fnames=['state'])

        return rslt