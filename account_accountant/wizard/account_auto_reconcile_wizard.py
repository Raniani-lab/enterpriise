from datetime import date

from odoo import fields, models, _
from odoo.exceptions import UserError


class AccountAutoReconcileWizard(models.TransientModel):
    """ This wizard is used to automatically reconcile account.move.line.
    It is accessible trough Accounting > Accounting tab > Actions > Auto-reconcile menuitem.
    """
    _name = 'account.auto.reconcile.wizard'
    _description = 'Account automatic reconciliation wizard'
    _check_company_auto = True

    company_id = fields.Many2one(
        comodel_name='res.company',
        required=True,
        readonly=True,
        default=lambda self: self.env.company,
    )
    from_date = fields.Date(string='From')
    to_date = fields.Date(string='To', default=fields.Date.context_today, required=True)
    account_ids = fields.Many2many(
        comodel_name='account.account',
        string='Accounts',
        domain="[('reconcile', '=', True), ('deprecated', '=', False), ('company_id', '=', company_id), ('internal_group', '!=', 'off_balance')]"
    )
    partner_ids = fields.Many2many(
        comodel_name='res.partner',
        string='Partners',
        check_company=True,
        domain="[('company_id', 'in', (False, company_id)), '|', ('parent_id', '=', False), ('is_company', '=', True)]",
    )
    search_mode = fields.Selection(
        selection=[
            ('one_to_one', 'Opposite balances one by one'),
            ('zero_balance', 'Accounts with zero balances'),
        ],
        string='Reconcile',
        required=True,
        default='one_to_one',
    )

    # ==== Business methods ====
    def _get_amls_domain(self):
        """ Get the domain of amls to be auto-reconciled. """
        self.ensure_one()
        domain = [
            ('company_id', '=', self.company_id.id),
            ('parent_state', '=', 'posted'),
            ('display_type', 'not in', ('line_section', 'line_note')),
            ('date', '>=', self.from_date or date.min),
            ('date', '<=', self.to_date),
            ('reconciled', '=', False),
            ('account_id.reconcile', '=', True),
            ('amount_residual_currency', '!=', 0.0),
            ('amount_residual', '!=', 0.0),  # excludes exchange difference lines
        ]
        if self.account_ids:
            domain.append(('account_id', 'in', self.account_ids.ids))
        if self.partner_ids:
            domain.append(('partner_id', 'in', self.partner_ids.ids))
        return domain

    def _auto_reconcile_one_to_one(self):
        """ Auto-reconcile with one-to-one strategy:
        We will reconcile 2 amls together if their combined balance is zero.
        :return: a recordset of reconciled amls
        """
        grouped_amls_data = self.env['account.move.line'].read_group(
            self._get_amls_domain(),
            ['id:recordset'],
            ['account_id', 'partner_id', 'currency_id', 'amount_residual_currency:abs_rounded'],
            lazy=False,
        )
        all_reconciled_amls = self.env['account.move.line']
        amls_grouped_by_2 = []  # we need to group amls with right format for _reconcile_plan
        for aml_data in grouped_amls_data:
            grouped_aml_ids = aml_data['id']
            positive_amls = grouped_aml_ids.filtered(lambda aml: aml.amount_residual_currency >= 0).sorted('date')
            negative_amls = (grouped_aml_ids - positive_amls).sorted('date')
            min_len = min(len(positive_amls), len(negative_amls))
            positive_amls = positive_amls[:min_len]
            negative_amls = negative_amls[:min_len]
            all_reconciled_amls += positive_amls + negative_amls
            amls_grouped_by_2 += [pos_aml + neg_aml for (pos_aml, neg_aml) in zip(positive_amls, negative_amls)]
        self.env['account.move.line']._reconcile_plan(amls_grouped_by_2)
        return all_reconciled_amls

    def _auto_reconcile_zero_balance(self):
        """ Auto-reconcile with zero balance strategy:
        We will reconcile all amls grouped by currency/account/partner that have a total balance of zero.
        :return: a recordset of reconciled amls
        """
        grouped_amls_data = self.env['account.move.line']._read_group(
            self._get_amls_domain(),
            groupby=['account_id', 'partner_id', 'currency_id'],
            aggregates=['id:recordset'],
            having=[('amount_residual_currency:sum_rounded', '=', 0)],
        )
        all_reconciled_amls = self.env['account.move.line']
        amls_grouped_together = []  # we need to group amls with right format for _reconcile_plan
        for aml_data in grouped_amls_data:
            all_reconciled_amls += aml_data[-1]
            amls_grouped_together += [aml_data[-1]]
        self.env['account.move.line']._reconcile_plan(amls_grouped_together)
        return all_reconciled_amls

    def auto_reconcile(self):
        """ Automatically reconcile amls given wizard's parameters.
        :return: an action that opens all reconciled items and related amls (exchange diff, etc)
        """
        self.ensure_one()
        if self.search_mode == 'zero_balance':
            reconciled_amls = self._auto_reconcile_zero_balance()
        else:
            # search_mode == 'one_to_one'
            reconciled_amls = self._auto_reconcile_one_to_one()
        reconciled_amls_and_related = self.env['account.move.line'].search([
            ('full_reconcile_id', 'in', reconciled_amls.full_reconcile_id.ids)
        ])
        if reconciled_amls_and_related:
            return {
                'name': _("Automatically Reconciled Entries"),
                'type': 'ir.actions.act_window',
                'res_model': 'account.move.line',
                'context': "{'group_by': 'full_reconcile_id'}",
                'view_mode': 'list',
                'domain': [('id', 'in', reconciled_amls_and_related.ids)],
            }
        else:
            raise UserError("Nothing to reconcile.")
