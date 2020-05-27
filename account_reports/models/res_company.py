# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ResCompany(models.Model):
    _inherit = "res.company"

    totals_below_sections = fields.Boolean(
        string='Add totals below sections',
        help='When ticked, totals and subtotals appear below the sections of the report.')
    account_tax_periodicity = fields.Selection([
        ('trimester', 'quarterly'),
        ('monthly', 'monthly')], string="Delay units", help="Periodicity", default='monthly')
    account_tax_periodicity_reminder_day = fields.Integer(string='Start from', default=7)
    account_tax_original_periodicity_reminder_day = fields.Integer(string='Start from original', help='technical helper to prevent rewriting activity date when saving settings')
    account_tax_periodicity_journal_id = fields.Many2one('account.journal', string='Journal', domain=[('type', '=', 'general')])
    account_tax_next_activity_type = fields.Many2one('mail.activity.type')
    account_revaluation_journal_id = fields.Many2one('account.journal', domain=[('type', '=', 'general')])
    account_revaluation_expense_provision_account_id = fields.Many2one('account.account', string='Expense Provision Account')
    account_revaluation_income_provision_account_id = fields.Many2one('account.account', string='Income Provision Account')

    def _get_default_misc_journal(self):
        """ Returns a default 'miscellanous' journal to use for
        account_tax_periodicity_journal_id field. This is useful in case a
        CoA was already installed on the company at the time the module
        is installed, so that the field is set automatically when added."""
        return self.env['account.journal'].search([('type', '=', 'general'), ('show_on_dashboard', '=', True), ('company_id', '=', self.id)], limit=1)

    def get_default_selected_tax_report(self):
        """ Returns the tax report object to be selected by default the first
        time the tax report is open for current company; or None if there isn't any.

        This method just selects the first available one, but is intended to be
        a hook for localization modules wanting to select a specific report
        depending on some particular factors (type of business, installed CoA, ...)
        """
        self.ensure_one()
        available_reports = self.get_available_tax_reports()
        return available_reports and available_reports[0] or None

    def get_available_tax_reports(self):
        """ Returns all the tax reports available for the country of the current
        company.
        """
        self.ensure_one()
        return self.env['account.tax.report'].search([('country_id', '=', self.get_fiscal_country().id)])

    def write(self, values):
        # in case the user want to change the journal or the periodicity without changing the date, we should change the next_activity
        # therefore we set the account_tax_original_periodicity_reminder_day to false so that it will be recomputed
        for company in self:
            if (values.get('account_tax_periodicity', company.account_tax_periodicity) != company.account_tax_periodicity \
            or values.get('account_tax_periodicity_journal_id', company.account_tax_periodicity_journal_id.id) != company.account_tax_periodicity_journal_id.id):
                values['account_tax_original_periodicity_reminder_day'] = False
        return super(ResCompany, self).write(values)
