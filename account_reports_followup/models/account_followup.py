># -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
from odoo import api, fields, models, _
from odoo.exceptions import Warning, UserError
from odoo.osv import expression


class FollowupLine(models.Model):
    _name = 'account_followup.followup.line'
    _description = 'Follow-up Criteria'
    _order = 'delay asc'

    name = fields.Char('Follow-Up Action', required=True, translate=True)
    sequence = fields.Integer(help="Gives the sequence order when displaying a list of follow-up lines.")
    delay = fields.Integer('Due Days', required=True,
                           help="The number of days after the due date of the invoice to wait before sending the reminder.  Could be negative if you want to send a polite alert beforehand.")
    company_id = fields.Many2one('res.company', 'Company', required=True, default=lambda self: self.env.company)
    sms_description = fields.Char('SMS Text Message', translate=True, default="Dear %(partner_name)s, it seems that some of your payments stay unpaid")
    description = fields.Text('Printed Message', translate=True, default="""
        Dear %(partner_name)s,

Exception made if there was a mistake of ours, it seems that the following amount stays unpaid. Please, take appropriate measures in order to carry out this payment in the next 8 days.

Would your payment have been carried out after this mail was sent, please ignore this message. Do not hesitate to contact our accounting department.

Best Regards,
""")
    send_email = fields.Boolean('Send an Email', help="When processing, it will send an email", default=True)
    print_letter = fields.Boolean('Print a Letter', help="When processing, it will print a PDF", default=True)
    send_sms = fields.Boolean('Send an SMS Text Message', help="When processing, it will send an sms text message", default=False)
    join_invoices = fields.Boolean('Join open Invoices')
    manual_action = fields.Boolean('Manual Action', help="When processing, it will set the manual action to be taken for that customer. ", default=False)
    manual_action_note = fields.Text('Action To Do', placeholder="e.g. Give a phone call, check with others , ...")
    manual_action_type_id = fields.Many2one('mail.activity.type', 'Manual Action Type', default=False)
    manual_action_responsible_id = fields.Many2one('res.users', 'Assign a Responsible', ondelete='set null')

    auto_execute = fields.Boolean()

    _sql_constraints = [('days_uniq', 'unique(company_id, delay)', 'Days of the follow-up levels must be different per company')]

    @api.constrains('description')
    def _check_description(self):
        for line in self:
            if line.description:
                try:
                    line.description % {'partner_name': '', 'date': '', 'user_signature': '', 'company_name': ''}
                except KeyError:
                    raise Warning(_('Your description is invalid, use the right legend or %% if you want to use the percent character.'))

    @api.constrains('sms_description')
    def _check_sms_description(self):
        for line in self:
            if line.sms_description:
                try:
                    line.sms_description % {'partner_name': '', 'date': '', 'user_signature': '', 'company_name': ''}
                except KeyError:
                    raise Warning(_('Your sms description is invalid, use the right legend or %% if you want to use the percent character.'))

    @api.onchange('auto_execute')
    def _onchange_auto_execute(self):
        if self.auto_execute:
            self.manual_action = False
            self.print_letter = False


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    followup_line_id = fields.Many2one('account_followup.followup.line', 'Follow-up Level', copy=False)
    followup_date = fields.Date('Latest Follow-up', index=True, copy=False)


class ResPartner(models.Model):
    _inherit = "res.partner"

    payment_responsible_id = fields.Many2one('res.users', ondelete='set null', string='Follow-up Responsible',
                                             help="Optionally you can assign a user to this field, which will make him responsible for the action.",
                                             tracking=True, copy=False, company_dependent=True)

    def _compute_join_invoices(self):
        for record in self:
            record.join_invoices = record._get_followup_level().join_invoices

    def _get_needofaction_fup_lines_domain(self, date):
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
        # we don't filter using company's days_between_two_followups as it is removed
        # from the setting view in this module although we technically could
        return domain

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

    def get_followup_html(self):
        options = {
            'partner_id': self.id,
            'followup_level': self.get_followup_level() or False,
            'keep_summary': True
        }
        return self.env['account.followup.report'].with_context(print_mode=True, lang=self.lang or self.env.user.lang).get_html(options)

    def get_followup_level(self):
        self.ensure_one()
        current_date = fields.Date.today()
        if self.payment_next_action_date and self.payment_next_action_date > current_date:
            return False

        fups = self._compute_followup_lines()
        level = None
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

    def _get_followup_level(self):
        self.ensure_one()
        FollowupLine = self.env['account_followup.followup.line']
        level = self.get_followup_level()
        return FollowupLine.browse(level[0]) if level else FollowupLine

    def _cron_execute_followup(self):
        FollowupLine = self.env['account_followup.followup.line']
        in_need_of_action = self._get_partners_in_need_of_action()
        in_need_of_action_auto = self.env['res.partner']
        for record in in_need_of_action:
            record.followup_level = record._get_followup_level()
            if record.followup_level.auto_execute:
                in_need_of_action_auto += record
        self.env['account.followup.report'].execute_followup(in_need_of_action_auto)

    def update_next_action(self, options=False):
        if not options or 'next_action_date' not in options or 'next_action_type' not in options:
            return
        next_action_date = options['next_action_date'][0:10]
        today = datetime.date.today()
        fups = self._compute_followup_lines()
        if not fups:
            raise UserError(_('You have to define at least one line in the followup levels of %s') % self.env.company.name)
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
