# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    @api.model
    def _get_default_misc_journal(self):
        user_company_id = self.env.user.company_id.id
        return self.env['account.journal'].search([('type', '=', 'general'), ('show_on_dashboard', '=', True), ('company_id', '=', self.id or user_company_id)], limit=1)

    days_between_two_followups = fields.Integer(string='Number of days between two follow-ups', default=14)
    totals_below_sections = fields.Boolean(
        string='Add totals below sections',
        help='When ticked, totals and subtotals appear below the sections of the report.')
    tax_periodicity = fields.Selection([
        ('trimester', 'trimester'),
        ('monthly', 'monthly')], string="Delay units", help="Periodicity", default='monthly')
    tax_periodicity_next_deadline = fields.Date(string='Start from', default=lambda self: fields.Date.context_today(self))
    original_tax_periodicity_next_deadline = fields.Date(string='Start from original', default=lambda self: fields.Date.context_today(self), help='technical helper to prevent rewriting activity date when saving settings')
    tax_periodicity_journal_id = fields.Many2one('account.journal', string='Journal', domain=[('type', '=', 'general')], default=_get_default_misc_journal)

    @api.multi
    def write(self, values):
        # in case the user want to change the journal or the periodicity without changing the date, we should change the next_activity
        # therefore we set the original_tax_periodicity_next_deadline to false so that it will be recomputed
        for company in self:
            if (values.get('tax_periodicity', company.tax_periodicity) != company.tax_periodicity \
            or values.get('tax_periodicity_journal_id', company.tax_periodicity_journal_id.id) != company.tax_periodicity_journal_id.id):
                values['original_tax_periodicity_next_deadline'] = False
        return super(ResCompany, self).write(values)
