# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.tools import date_utils
from dateutil.relativedelta import relativedelta


class AccountTaxReportActivityType(models.Model):
    _inherit = "mail.activity.type"

    category = fields.Selection(selection_add=[('tax_report', 'Tax report')])
    company_id = fields.Many2one('res.company')

class AccountTaxReportActivity(models.Model):
    _inherit = "mail.activity"

    # This method can be overwritten by custom localization modules that want to open specific report for tva closing
    @api.multi
    def _get_vat_report_action_to_open(self, company_id):
        return self.env.ref('account_reports.action_account_report_gt').read()[0]

    @api.multi
    def action_open_tax_report(self):
        self.ensure_one()
        action = self._get_vat_report_action_to_open(self.activity_type_id.company_id or self.env.user.company_id)
        options = action.get('options', {})
        if self.env.user.company_id.tax_lock_date:
            date_from = date_utils.add(self.env.user.company_id.tax_lock_date, days=1)
            date_to = self.date_deadline
        else:
            date_from = date_utils.start_of(self.date_deadline, 'year')
            date_to = self.date_deadline
        options['date'] = {'date_from': date_from, 'date_to': date_to, 'filter': 'custom'}
        # Pass options in context and set ignore_session: read to prevent reading previous options
        action.update({'options': options, 'ignore_session': 'read'})
        return action

    @api.onchange('activity_type_id')
    def _onchange_activity_type_id(self):
        if self.activity_type_id and self.activity_type_id.category == 'tax_report':
            self.summary = self.activity_type_id.summary
            # Date.context_today is correct because date_deadline is a Date and is meant to be
            # expressed in user TZ
            base = fields.Date.context_today(self)
            if self.activity_type_id.delay_from == 'previous_activity' and 'activity_previous_deadline' in self.env.context:
                base = fields.Date.from_string(self.env.context.get('activity_previous_deadline'))
            self.date_deadline = date_utils.end_of(base + relativedelta(**{self.activity_type_id.delay_unit: self.activity_type_id.delay_count}), 'month')
        else:
            super(AccountTaxReportActivity, self)._onchange_activity_type_id()


class AccountMailThread(models.AbstractModel):
    _inherit = 'mail.thread'

    def message_post_with_view(self, views_or_xmlid, **kwargs):
        # find tax_report activity type:
        tax_report_activity_type = self.env['mail.activity.type'].sudo().search([('category', '=', 'tax_report')])
        if tax_report_activity_type:
            activity_type_ids = tax_report_activity_type.ids
            if views_or_xmlid == 'mail.message_activity_done' and kwargs.get('mail_activity_type_id', False) and kwargs.get('mail_activity_type_id') in activity_type_ids:
                return super(AccountMailThread, self).message_post_with_view('account_reports.message_activity_done', **kwargs)
        return super(AccountMailThread, self).message_post_with_view(views_or_xmlid, **kwargs)