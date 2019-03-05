# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, fields
from odoo.tools.translate import _
from odoo.tools.misc import formatLang, format_date
from odoo.exceptions import UserError, RedirectWarning
from odoo.addons.web.controllers.main import clean_action

class generic_tax_report(models.AbstractModel):
    _inherit = 'account.report'
    _name = 'account.generic.tax.report'
    _description = 'Generic Tax Report'

    filter_multi_company = None
    filter_date = {'mode': 'range', 'filter': 'this_month'}
    filter_all_entries = False
    filter_comparison = {'date_from': '', 'date_to': '', 'filter': 'no_comparison', 'number_period': 1}

    def _get_reports_buttons(self):
        res = super(generic_tax_report, self)._get_reports_buttons()
        res.append({'name': _('Periodic TVA closing'), 'action': 'periodic_tva_entries'})
        return res

    def _compute_vat_closing_entry(self):
        """ This method returns the one2many commands to balance the tax accounts for the selected period, and
        a dictionnary that will help balance the different accounts set per tax group.
        """
        # first, for each tax group, gather the tax entries per tax and account
        sql = """SELECT "account_move_line".tax_line_id as tax_id,
                    tax.tax_group_id as tax_group_id,
                    tax.name as tax_name,
                    "account_move_line".account_id, COALESCE(SUM("account_move_line".debit-"account_move_line".credit), 0) as amount
                    FROM account_tax tax, %s
                    WHERE %s AND tax.id = "account_move_line".tax_line_id AND "account_move_line".tax_exigible
                    GROUP BY tax.tax_group_id, "account_move_line".tax_line_id, tax.name, "account_move_line".account_id
                """
        tables, where_clause, where_params = self.env['account.move.line']._query_get()
        query = sql % (tables, where_clause)
        self.env.cr.execute(query, where_params)
        results = self.env.cr.dictfetchall()
        if not len(results):
            raise UserError(_("Nothing to process"))

        tax_group_ids = [r['tax_group_id'] for r in results]
        tax_groups = {}
        for tg, result in zip(self.env['account.tax.group'].browse(tax_group_ids), results):
            if tg not in tax_groups:
                tax_groups[tg] = {}
            tax_groups[tg][result.get('tax_id')] = (result.get('tax_name'), result.get('account_id'), result.get('amount'))

        # then loop on previous results to
        #    * add the lines that will balance their sum per account
        #    * make the total per tax group's account triplet
        # (if 2 tax groups share the same 3 accounts, they should consolidate in the vat closing entry)
        move_vals_lines = []
        tax_group_subtotal = {}
        for tg, value in tax_groups.items():
            total = 0
            # ignore line that have no property defined on tax group
            if not tg.property_tax_receivable_account_id or not tg.property_tax_payable_account_id:
                continue
            for dummy, values in value.items():
                tax_name, account_id, amt = values
                # Line to balance
                move_vals_lines.append((0, 0, {'name': tax_name, 'debit': abs(amt) if amt < 0 else 0, 'credit': amt if amt > 0 else 0, 'account_id': account_id}))
                total += amt

            if total != 0:
                # Add total to correct group
                key = (tg.property_advance_tax_payment_account_id.id or False, tg.property_tax_receivable_account_id.id, tg.property_tax_payable_account_id.id)

                if tax_group_subtotal.get(key):
                    tax_group_subtotal[key] += total
                else:
                    tax_group_subtotal[key] = total
        return move_vals_lines, tax_group_subtotal

    def _add_tax_group_closing_items(self, tax_group_subtotal, end_date):
        """this method transforms the parameter tax_group_subtotal dictionnary into one2many commands
        to balance the tax group accounts for the creation of the vat closing entry.
        """
        def _add_line(account, name):
            self.env.cr.execute(sql_account, (account, end_date))
            result = self.env.cr.dictfetchall()[0]
            advance_balance = result.get('balance') or 0
            # Deduct/Add advance payment
            if advance_balance != 0:
                line_ids_vals.append((0, 0, {
                    'name': name,
                    'debit': abs(advance_balance) if advance_balance < 0 else 0,
                    'credit': abs(advance_balance) if advance_balance > 0 else 0,
                    'account_id': account
                }))
            return advance_balance

        sql_account = 'SELECT sum(debit)-sum(credit) AS balance FROM account_move_line where account_id = %s and date <= %s'
        line_ids_vals = []
        # keep track of already balanced account, as one can be used in several tax group
        account_already_balanced = []
        for key, value in tax_group_subtotal.items():
            total = value
            # Search if any advance payment done for that configuration
            if key[0] and key[0] not in account_already_balanced:
                total += _add_line(key[0], _('Balance tax advance payment account'))
                account_already_balanced.append(key[0])
            if key[1] and key[1] not in account_already_balanced:
                total += _add_line(key[1], _('Balance tax current account (receivable)'))
                account_already_balanced.append(key[1])
            if key[2] and key[2] not in account_already_balanced:
                total += _add_line(key[2], _('Balance tax current account (payable)'))
                account_already_balanced.append(key[2])
            # Balance on the receivable/payable tax account
            if total != 0:
                line_ids_vals.append((0, 0, {
                    'name': total < 0 and _('Payable tax amount') or _('Receivable tax amount'),
                    'debit': total if total > 0 else 0,
                    'credit': abs(total) if total < 0 else 0,
                    'account_id': key[2] if total < 0 else key[1]
                }))
        return line_ids_vals

    def _post_tax_entries(self, options):
        """ This method is used to automatically post a move for the VAT declaration by doing the following
         Search on all taxes line in the given period, group them by tax_group (each tax group might have its own
         tax receivable/payable account). Create a move line that balance each tax account and add the differene in
         the correct receivable/payable account. Also takes into account amount already paid via advance tax payment account.
        """
        # make the preliminary checks
        company = self.env.user.company_id
        if options.get('multi_company'):
            # Ensure that we only have one company selected
            selected_company = False
            for c in options.get('multi_company'):
                if c.get('selected') and selected_company:
                    raise UserError(_("You can only post tax entries for one company at a time"))
                elif c.get('selected'):
                    selected_company = c.get('id')
            if selected_company:
                company = self.env['res.company'].browse(selected_company)

        start_date = fields.Date.from_string(options.get('date').get('date_from'))
        end_date = fields.Date.from_string(options.get('date').get('date_to'))
        if company.tax_lock_date and company.tax_lock_date >= end_date:
            raise UserError(_("This period is already closed"))

        # get tax entries by tax_group for the period defined in options
        line_ids_vals, tax_group_subtotal = self._compute_vat_closing_entry()
        line_ids_vals += self._add_tax_group_closing_items(tax_group_subtotal, end_date)

        # create new move
        journal_id = company.tax_periodicity_journal_id
        if len(line_ids_vals):
            move_vals = {
                'date': end_date,
                'journal_id': journal_id.id,
                'ref': _('Tax Return %s - %s') % (format_date(self.env, start_date), format_date(self.env, end_date)),
                'line_ids': line_ids_vals
                }
            move = self.env['account.move'].create(move_vals)
        else:
            action = self.env.ref('account.action_tax_group')
            msg = _('It seems that you have no entries to post, are you sure you correctly configured the accounts on your tax groups?')
            raise RedirectWarning(msg, action.id, _('Configure your VAT accounts'))

        # Mark ir_activity as done
        activity_type = self.env['mail.activity.type'].search([('category', '=', 'tax_report'), ('company_id', '=', company.id)])
        journal_res_model_id = self.env['ir.model'].search([('model', '=', 'account.journal')], limit=1).id
        if activity_type:
            activity = self.env['mail.activity'].search(
                [('res_id', '=', journal_id.id),
                ('res_model_id', '=', journal_res_model_id),
                ('activity_type_id', '=', activity_type.id)], order="date_deadline desc", limit=1)
            if len(activity):
                activity.action_feedback_schedule_next({'move_id': move.id, 'move_name': move.name, 'date_from': format_date(self.env, start_date), 'date_to': format_date(self.env, end_date)})

        # Change lock date to end_date of options
        company.tax_lock_date = end_date
        return move

    def _get_columns_name(self, options):
        columns_header = [{}, {'name': '%s \n %s' % (_('NET'), self.format_date(options)), 'class': 'number', 'style': 'white-space: pre;'}, {'name': _('TAX'), 'class': 'number'}]
        if options.get('comparison') and options['comparison'].get('periods'):
            for p in options['comparison']['periods']:
                columns_header += [{'name': '%s \n %s' % (_('NET'), p.get('string')), 'class': 'number', 'style': 'white-space: pre;'}, {'name': _('TAX'), 'class': 'number'}]
        return columns_header

    def _set_context(self, options):
        ctx = super(generic_tax_report, self)._set_context(options)
        ctx['strict_range'] = True
        return ctx

    def _sql_cash_based_taxes(self):
        sql = """SELECT tax.id, SUM(CASE WHEN tax.type_tax_use = 'sale' THEN -"account_move_line".tax_base_amount ELSE "account_move_line".tax_base_amount END), SUM("account_move_line".balance) FROM account_tax tax, %s WHERE tax.id = "account_move_line".tax_line_id AND %s AND tax.tax_exigibility = 'on_payment' and "account_move_line".tax_exigible GROUP BY tax.id"""
        return sql

    def _sql_tax_amt_regular_taxes(self):
        sql = """SELECT "account_move_line".tax_line_id, COALESCE(SUM("account_move_line".debit-"account_move_line".credit), 0)
                    FROM account_tax tax, %s
                    WHERE %s AND tax.tax_exigibility = 'on_invoice' AND tax.id = "account_move_line".tax_line_id
                    GROUP BY "account_move_line".tax_line_id"""
        return sql

    def _sql_net_amt_regular_taxes(self):
        sql = """SELECT r.account_tax_id, COALESCE(SUM("account_move_line".debit-"account_move_line".credit), 0)
                 FROM %s
                 INNER JOIN account_move_line_account_tax_rel r ON ("account_move_line".id = r.account_move_line_id)
                 INNER JOIN account_tax t ON (r.account_tax_id = t.id)
                 WHERE %s AND t.tax_exigibility = 'on_invoice' GROUP BY r.account_tax_id"""
        return sql

    def _compute_from_amls(self, options, taxes, period_number):
        sql = self._sql_cash_based_taxes()
        tables, where_clause, where_params = self.env['account.move.line']._query_get()
        query = sql % (tables, where_clause)
        self.env.cr.execute(query, where_params)
        results = self.env.cr.fetchall()
        for result in results:
            if result[0] in taxes:
                taxes[result[0]]['periods'][period_number]['net'] = result[1]
                taxes[result[0]]['periods'][period_number]['tax'] = result[2]
                taxes[result[0]]['show'] = True
        sql = self._sql_net_amt_regular_taxes()
        query = sql % (tables, where_clause)
        self.env.cr.execute(query, where_params)
        results = self.env.cr.fetchall()
        for result in results:
            if result[0] in taxes:
                taxes[result[0]]['periods'][period_number]['net'] = result[1]
                taxes[result[0]]['show'] = True
        sql = self._sql_tax_amt_regular_taxes()
        query = sql % (tables, where_clause)
        self.env.cr.execute(query, where_params)
        results = self.env.cr.fetchall()
        for result in results:
            if result[0] in taxes:
                taxes[result[0]]['periods'][period_number]['tax'] = result[1]
                taxes[result[0]]['show'] = True

    def _get_type_tax_use_string(self, value):
        return [option[1] for option in self.env['account.tax']._fields['type_tax_use'].selection if option[0] == value][0]

    def _get_type_tax_use_string(self, value):
        return [option[1] for option in self.env['account.tax']._fields['type_tax_use'].selection if option[0] == value][0]

    @api.model
    def _get_lines(self, options, line_id=None):
        taxes = {}
        for tax in self.env['account.tax'].with_context(active_test=False).search([]):
            taxes[tax.id] = {'obj': tax, 'show': False, 'periods': [{'net': 0, 'tax': 0}]}
            for period in options['comparison'].get('periods'):
                taxes[tax.id]['periods'].append({'net': 0, 'tax': 0})
        period_number = 0
        self._compute_from_amls(options, taxes, period_number)
        for period in options['comparison'].get('periods'):
            period_number += 1
            self.with_context(date_from=period.get('date_from'), date_to=period.get('date_to'))._compute_from_amls(options, taxes, period_number)
        lines = []
        types = ['sale', 'purchase', 'adjustment']
        groups = dict((tp, {}) for tp in types)
        for key, tax in taxes.items():
            if tax['obj'].type_tax_use == 'none':
                continue
            if tax['obj'].children_tax_ids:
                tax['children'] = []
                for child in tax['obj'].children_tax_ids:
                    if child.type_tax_use != 'none':
                        continue
                    tax['children'].append(taxes[child.id])
            if tax['obj'].children_tax_ids and not tax.get('children'):
                continue
            groups[tax['obj'].type_tax_use][key] = tax
        line_id = 0
        for tp in types:
            if not any([tax.get('show') for key, tax in groups[tp].items()]):
                continue
            sign = tp == 'sale' and -1 or 1
            lines.append({
                    'id': tp,
                    'name': self._get_type_tax_use_string(tp),
                    'unfoldable': False,
                    'columns': [{} for k in range(0, 2 * (period_number + 1) or 2)],
                    'level': 1,
                })
            for key, tax in sorted(groups[tp].items(), key=lambda k: k[1]['obj'].sequence):
                if tax['show']:
                    columns = []
                    for period in tax['periods']:
                        columns += [{'name': self.format_value(period['net'] * sign), 'style': 'white-space:nowrap;'},{'name': self.format_value(period['tax'] * sign), 'style': 'white-space:nowrap;'}]
                    lines.append({
                        'id': tax['obj'].id,
                        'name': tax['obj'].name + ' (' + str(tax['obj'].amount) + ')',
                        'unfoldable': False,
                        'columns': columns,
                        'level': 4,
                        'caret_options': 'account.tax',
                    })
                    for child in tax.get('children', []):
                        columns = []
                        for period in child['periods']:
                            columns += [{'name': self.format_value(period['net'] * sign), 'style': 'white-space:nowrap;'},{'name': self.format_value(period['tax'] * sign), 'style': 'white-space:nowrap;'}]
                        lines.append({
                            'id': child['obj'].id,
                            'name': '   ' + child['obj'].name + ' (' + str(child['obj'].amount) + ')',
                            'unfoldable': False,
                            'columns': columns,
                            'level': 4,
                            'caret_options': 'account.tax',
                        })
            line_id += 1
        return lines

    @api.model
    def _get_report_name(self):
        return _('Tax Report')
