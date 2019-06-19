# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta
from odoo import api, fields, models, _
from odoo.tools.misc import format_date
from odoo.osv import expression
import datetime


class ResPartner(models.Model):
    _name = 'res.partner'
    _inherit = 'res.partner'

    payment_next_action_date = fields.Date('Next Action Date', copy=False, company_dependent=True,
                                           help="The date before which no action should be taken.")
    unreconciled_aml_ids = fields.One2many('account.move.line', 'partner_id',
                                           domain=[('reconciled', '=', False),
                                                   ('account_id.deprecated', '=', False),
                                                   ('account_id.internal_type', '=', 'receivable')])
    unpaid_invoices = fields.One2many('account.move', compute='_compute_unpaid_invoices', store=False)
    total_due = fields.Monetary(compute='_compute_for_followup', store=False, readonly=True)
    total_overdue = fields.Monetary(compute='_compute_for_followup', store=False, readonly=True)
    followup_status = fields.Selection(
        [('in_need_of_action', 'In need of action'), ('with_overdue_invoices', 'With overdue invoices'), ('no_action_needed', 'No action needed')],
        compute='_compute_for_followup',
        store=False,
        string='Follow-up Status',
        search='_search_status')
    followup_level = fields.Many2one('account_followup.followup.line', compute="_compute_for_followup", string="Follow-up Level")
    payment_responsible_id = fields.Many2one('res.users', ondelete='set null', string='Follow-up Responsible',
                                             help="Optionally you can assign a user to this field, which will make him responsible for the action.",
                                             tracking=True, copy=False, company_dependent=True)

    def _search_status(self, operator, value):
        """
        Compute the search on the field 'followup_status'
        """
        if isinstance(value, str):
            value = [value]
        value = [v for v in value if v in ['in_need_of_action', 'with_overdue_invoices', 'no_action_needed']]
        print(value)
        if operator not in ('in', '=') or not value:
            return []
        results = self._get_partners_in_need_of_action(overdue_only=(value == ['with_overdue_invoices']))

        print(results.mapped('followup_status'))
        return [('id', 'in', results.filtered(lambda r:r.followup_status in value).ids)]

    def _compute_for_followup(self):
        """
        Compute the fields 'total_due', 'total_overdue' and 'followup_status'
        """
        partners_in_need_of_action = self._get_partners_in_need_of_action()
        today = fields.Date.context_today(self)
        for record in self:
            total_due = 0
            total_overdue = 0
            followup_status = "no_action_needed"
            for aml in record.unreconciled_aml_ids:
                if aml.company_id == self.env.company:
                    amount = aml.amount_residual
                    total_due += amount
                    is_overdue = today > aml.date_maturity if aml.date_maturity else today > aml.date
                    if is_overdue:
                        total_overdue += not aml.blocked and amount or 0
            if total_overdue > 0:
                followup_status = "in_need_of_action" if record in partners_in_need_of_action else "with_overdue_invoices"
            else:
                followup_status = "no_action_needed"
            record.total_due = total_due
            record.total_overdue = total_overdue
            record.followup_status = followup_status
            level = record.get_followup_level()
            record.followup_level = self.env['account_followup.followup.line'].browse(level[0]) if level else False

    def _compute_unpaid_invoices(self):
        for record in self:
            record.unpaid_invoices = self.env['account.move'].search([('commercial_partner_id', '=', record.id), ('state', '=', 'posted'), ('invoice_payment_state', '!=', 'paid'), ('type', 'in', self.env['account.move'].get_sale_types())])

    def _get_partners_in_need_of_action(self, overdue_only=False):
        """
        Return a list of partner ids which are in status 'in_need_of_action'.
        If 'overdue_only' is set to True, partners in status 'with_overdue_invoices' are included in the list
        """
        today = fields.Date.context_today(self)
        domain = self.get_followup_lines_domain(overdue_only=overdue_only, only_unblocked=True)
        query = self.env['account.move.line']._where_calc(domain)
        tables, where_clause, where_params = query.get_sql()
        sql = """SELECT "account_move_line".partner_id
                 FROM %s
                 WHERE %s
                   AND "account_move_line".partner_id IS NOT NULL
                 GROUP BY "account_move_line".partner_id"""
        query = sql % (tables, where_clause)
        self.env.cr.execute(query, where_params)
        result = self.env.cr.fetchall()
        return self.browse([r[0] for r in result] if result else [])

    def _get_needofaction_fup_lines_domain(self):
        """ returns the part of the domain on account.move.line that will filter lines ready to reach another followup level.
        This is achieved by looking if a line at a certain followup level has a COALESCE(date_maturity, date) older than the
        pivot date where it should get to the next level."""
        domain = []
        fups = self._compute_followup_lines()
        for fup_level_id, fup_level_info in fups.items():
            domain = expression.OR([
                domain,
                [('followup_line_id', '=', fup_level_id or False)] +
                expression.OR([
                    [('date_maturity', '!=', False), ('date_maturity', '<=', fup_level_info[0])],
                    [('date_maturity', '=', False), ('date', '<=', fup_level_info[0])]
                ])
            ])
        return domain


    def get_followup_lines_domain(self, overdue_only=False, only_unblocked=False):
        domain = [('reconciled', '=', False), ('account_id.deprecated', '=', False), ('account_id.internal_type', '=', 'receivable'), '|', ('debit', '!=', 0), ('credit', '!=', 0), ('company_id', '=', self.env.company.id)]
        if only_unblocked:
            domain += [('blocked', '=', False)]
        if self.ids:
            if 'exclude_given_ids' in self._context:
                domain += [('partner_id', 'not in', self.ids)]
            else:
                domain += [('partner_id', 'in', self.ids)]

        if not overdue_only:
            domain += self._get_needofaction_fup_lines_domain()
        else:
            partners_in_need_of_action = self._get_partners_in_need_of_action()
            domain = expression.AND([domain, ['!', ('partner_id', 'in', partners_in_need_of_action.ids)]])
        return domain

    def get_next_action(self, followup_line):
        """
        Compute the next action status of the customer. It can be 'manual' or 'auto'.
        """
        self.ensure_one()
        date_auto = format_date(self.env, self.env['account.followup.report']._get_next_date(followup_line, fields.Date.today()))
        if self.payment_next_action_date:
            return {
                'type': 'manual',
                'date': self.payment_next_action_date,
                'date_auto': date_auto
            }
        return {
            'type': 'auto',
            'date_auto': date_auto
        }

    def change_next_action(self, date):
        for record in self:
            msg = _('Next action date: ') + date
            record.message_post(body=msg)
        return True

    def update_next_action(self, options=False):
        """Updates the next_action_date of the right account move lines"""
        if not options or 'next_action_date' not in options or 'next_action_type' not in options:
            return
        next_action_date = options['next_action_date'][0:10]
        today = datetime.date.today()
        fups = self._compute_followup_lines()
        for partner in self:
            if options['next_action_type'] == 'manual':
                partner.change_next_action(next_action_date)
            partner.payment_next_action_date = next_action_date
            for aml in partner.unreconciled_aml_ids:
                index = aml.followup_line_id.id or None
                followup_date = fups[index][0]
                next_level = fups[index][1]
                if (aml.date_maturity and aml.date_maturity <= followup_date
                        or (aml.date and aml.date <= followup_date)):
                    aml.write({'followup_line_id': next_level, 'followup_date': today})

    def open_action_followup(self):
        self.ensure_one()
        return {
            'name': _("Overdue Payments for %s") % self.display_name,
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'views': [[self.env.ref('account_followup.customer_statements_form_view').id, 'form']],
            'res_model': 'res.partner',
            'res_id': self.id,
        }

    def open_partner_ledger(self):
        return {
            'type': 'ir.actions.client',
            'name': _('Partner Ledger'),
            'tag': 'account_report',
            'options': {'partner_ids': [self.id]},
            'ignore_session': 'both',
            'context': "{'model':'account.partner.ledger'}"
        }

    def send_followup_email(self):
        """
        Send a follow-up report by email to customers in self
        """
        for record in self:
            options = {
                'partner_id': record.id,
            }
            self.env['account.followup.report'].send_email(options)

    def get_followup_html(self):
        """
        Return the content of the follow-up report in HTML
        """
        options = {
            'partner_id': self.id,
            'followup_level': self.get_followup_level() or False,
            'keep_summary': True
        }
        return self.env['account.followup.report'].with_context(print_mode=True, lang=self.lang or self.env.user.lang).get_html(options)

    def _compute_followup_lines(self):
        """ returns the followup plan of the current user's company (of given in context directly)
        in the form of a dictionary with
         * keys being the different possible levels of followup for account.move.line's (None or IDs of account_followup.followup.line)
         * values being a tuple of 3 elements corresponding respectively to
           - the oldest date that any line in that followup level should be compared to in order to know if it is ready for the next level
           - the followup ID of the next level
           - the delays in days of the next level
        """
        followup_line_ids = self.env['account_followup.followup.line'].search([('company_id', '=', self.env.company.id)], order="delay asc")

        current_date = fields.Date.today()

        previous_level = None
        fups = {}
        for line in followup_line_ids:
            delay = datetime.timedelta(days=line.delay)
            delay_in_days = line.delay
            fups[previous_level] = (current_date - delay, line.id, delay_in_days)
            previous_level = line.id
        if previous_level:
            fups[previous_level] = (current_date - delay, previous_level, delay_in_days)
        return fups

    def get_followup_level(self):
        self.ensure_one()
        current_date = fields.Date.today()

        fups = self._compute_followup_lines()
        level = None
        if fups:
            level = (fups[None][1], 0)
        if fups:
            for aml in self.unreconciled_aml_ids:
                if aml.company_id == self.env.company:
                    index = aml.followup_line_id.id or None
                    followup_date = fups[index][0]
                    next_level = fups[index][1]
                    delay = fups[index][2]
                    if (aml.date_maturity and aml.date_maturity <= followup_date) or (current_date <= followup_date):
                        if level is None or level[1] < delay:
                            level = (next_level, delay)
        return level

    def _cron_execute_followup(self):
        in_need_of_action = self._get_partners_in_need_of_action()
        in_need_of_action_auto = self.env['res.partner']
        for record in in_need_of_action:
            if record.followup_level.auto_execute:
                in_need_of_action_auto += record
        self.env['account.followup.report'].execute_followup(in_need_of_action_auto)
