# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ResCompany(models.Model):
    _inherit = "res.company"

    overdue_sms_msg = fields.Text(string='Overdue Payments SMS Message', translate=True,
        default=lambda s: _("""Our records indicate that some payments on your account are still due.
If you have any queries regarding your account, Please contact us. Best Regards,"""))

    @api.model
    def _get_default_misc_journal(self):
        user_company_id = self.env.company.id
        return self.env['account.journal'].search([('type', '=', 'general'), ('show_on_dashboard', '=', True), ('company_id', '=', self.id or user_company_id)], limit=1)

    days_between_two_followups = fields.Integer(string='Number of days between two follow-ups', default=14)
    totals_below_sections = fields.Boolean(
        string='Add totals below sections',
        help='When ticked, totals and subtotals appear below the sections of the report.')
    account_tax_periodicity = fields.Selection([
        ('trimester', 'trimester'),
        ('monthly', 'monthly')], string="Delay units", help="Periodicity", default='monthly')
    account_tax_periodicity_reminder_day = fields.Integer(string='Start from', default=7)
    account_tax_original_periodicity_reminder_day = fields.Integer(string='Start from original', help='technical helper to prevent rewriting activity date when saving settings')
    account_tax_periodicity_journal_id = fields.Many2one('account.journal', string='Journal', domain=[('type', '=', 'general')], default=_get_default_misc_journal)
    account_tax_next_activity_type = fields.Many2one('mail.activity.type')

    def write(self, values):
        # in case the user want to change the journal or the periodicity without changing the date, we should change the next_activity
        # therefore we set the account_tax_original_periodicity_reminder_day to false so that it will be recomputed
        for company in self:
            if (values.get('account_tax_periodicity', company.account_tax_periodicity) != company.account_tax_periodicity \
            or values.get('account_tax_periodicity_journal_id', company.account_tax_periodicity_journal_id.id) != company.account_tax_periodicity_journal_id.id):
                values['account_tax_original_periodicity_reminder_day'] = False
        return super(ResCompany, self).write(values)
