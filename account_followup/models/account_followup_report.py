# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import markupsafe

from odoo import models, fields, api
from odoo.tools.misc import formatLang, format_date, get_lang
from odoo.tools.translate import _
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT, html2plaintext
from odoo.exceptions import UserError


class AccountFollowupReport(models.AbstractModel):
    _name = 'account.followup.report'
    _description = "Follow-up Report"

    # This report, while not an account.report per se, still uses (inherited) templates from account_reports
    main_table_header_template = 'account_followup.table_header_template_followup_report'

    filter_show_draft = False

    ####################################################
    # REPORT COMPUTATION - TEMPLATE RENDERING
    ####################################################

    @api.model
    def get_followup_informations(self, partner_id, options):
        """
        Return all informations needed by the view:
        - the report manager id
        - the content in HTML of the report
        - the state of the next_action
        """
        options['partner_id'] = partner_id
        partner = self.env['res.partner'].browse(partner_id)
        followup_line = partner.followup_level
        if followup_line and followup_line._amount_due_in_description() and options.get('total_due', -1) != partner.total_due:
            options['keep_summary'] = False
        html = self.get_followup_report_html(options)
        next_action = False
        if not options.get('keep_summary'):
            next_action = partner.get_next_action(followup_line)
        infos = {
            'html': html,
            'next_action': next_action,
            'total_due': partner.total_due,
        }
        if partner.followup_level:
            infos['followup_level'] = self._get_line_info(followup_line)
        return infos

    def get_followup_report_html(self, options):
        """
        Return the html of the followup report, based on the report options.
        """
        template = 'account_followup.template_followup_report'
        render_values = self._get_followup_report_html_render_values(options)

        headers = [self._get_followup_report_columns_name()]
        lines = self._get_followup_report_lines(options)

        # Catch negative numbers when present
        for line in lines:
            for col in line['columns']:
                if self.env.company.currency_id.compare_amounts(col.get('no_format', 0.0), 0.0) == -1:
                    col['class'] = 'number color-red'

        render_values['lines'] = {'columns_header': headers, 'lines': lines}

        return self.env['ir.qweb']._render(template, render_values)

    def _get_followup_report_lines(self, options):
        """
        Compute and return the lines of the columns of the follow-ups report.
        """
        # Get date format for the lang
        partner = options.get('partner_id') and self.env['res.partner'].browse(options['partner_id']) or False
        if not partner:
            return []

        lang_code = partner.lang if self._context.get('print_mode') else self.env.user.lang or get_lang(self.env).code
        lines = []
        res = {}
        today = fields.Date.today()
        line_num = 0
        for l in partner.unreconciled_aml_ids.sorted():
            if l.company_id == self.env.company:
                if self.env.context.get('print_mode') and l.blocked:
                    continue
                currency = l.currency_id or l.company_id.currency_id
                if currency not in res:
                    res[currency] = []
                res[currency].append(l)
        for currency, aml_recs in res.items():
            total = 0
            total_issued = 0
            for aml in aml_recs:
                amount = aml.amount_residual_currency if aml.currency_id else aml.amount_residual
                date_due = format_date(self.env, aml.date_maturity or aml.move_id.invoice_date or aml.date, lang_code=lang_code)
                total += not aml.blocked and amount or 0
                is_overdue = today > aml.date_maturity if aml.date_maturity else today > aml.date
                is_payment = aml.payment_id
                if is_overdue or is_payment:
                    total_issued += not aml.blocked and amount or 0
                if is_overdue:
                    date_due = {'name': date_due, 'class': 'color-red date', 'style': 'white-space:nowrap;text-align:right;color: red;'}
                if is_payment:
                    date_due = ''
                move_line_name = self._followup_report_format_aml_name(aml.name, aml.move_id.ref)
                if self.env.context.get('print_mode'):
                    move_line_name = {'name': move_line_name, 'style': 'text-align:right; white-space:normal;'}
                amount = formatLang(self.env, amount, currency_obj=currency)
                line_num += 1
                expected_pay_date = format_date(self.env, aml.expected_pay_date, lang_code=lang_code) if aml.expected_pay_date else ''
                invoice_origin = aml.move_id.invoice_origin or ''
                if len(invoice_origin) > 43:
                    invoice_origin = invoice_origin[:40] + '...'
                columns = [
                    format_date(self.env, aml.move_id.invoice_date or aml.date, lang_code=lang_code),
                    date_due,
                    invoice_origin,
                    move_line_name,
                    (expected_pay_date and expected_pay_date + ' ') + (aml.internal_note or ''),
                    {'name': '', 'blocked': aml.blocked, 'template': 'account_followup.cell_template_followup_report'},
                    amount,
                ]
                if self.env.context.get('print_mode'):
                    columns = columns[:4] + columns[6:]
                lines.append({
                    'id': aml.id,
                    'account_move': aml.move_id,
                    'name': aml.move_id.name,
                    'caret_options': 'followup',
                    'move_id': aml.move_id.id,
                    'type': is_payment and 'payment' or 'unreconciled_aml',
                    'unfoldable': False,
                    'columns': [isinstance(v, dict) and v or {'name': v} for v in columns],
                })
            total_due = formatLang(self.env, total, currency_obj=currency)
            line_num += 1
            lines.append({
                'id': line_num,
                'name': '',
                'class': 'total',
                'style': 'border-top-style: double',
                'unfoldable': False,
                'level': 3,
                'columns': [{'name': v} for v in [''] * (3 if self.env.context.get('print_mode') else 5) + [total >= 0 and _('Total Due') or '', total_due]],
            })
            if total_issued > 0:
                total_issued = formatLang(self.env, total_issued, currency_obj=currency)
                line_num += 1
                lines.append({
                    'id': line_num,
                    'name': '',
                    'class': 'total',
                    'unfoldable': False,
                    'level': 3,
                    'columns': [{'name': v} for v in [''] * (3 if self.env.context.get('print_mode') else 5) + [_('Total Overdue'), total_issued]],
                })
            # Add an empty line after the total to make a space between two currencies
            line_num += 1
            lines.append({
                'id': line_num,
                'name': '',
                'class': '',
                'style': 'border-bottom-style: none',
                'unfoldable': False,
                'level': 0,
                'columns': [{} for col in columns],
            })
        # Remove the last empty line
        if lines:
            lines.pop()
        return lines

    def _get_followup_report_html_render_values(self, options):
        # Needed for account_reports templates
        options['show_debug_column'] = False
        partner = self.env['res.partner'].browse(options['partner_id'])
        return {
            'partner': partner,
            'lang': partner.lang or get_lang(self.env).code,
            'invoice_address_id': self.env['res.partner'].browse(partner.address_get(['invoice'])['invoice']),
            'today': fields.date.today().strftime(DEFAULT_SERVER_DATE_FORMAT),
            'report_summary': self._get_default_summary(options),
            'report': self,
            'report_title': _("Payment Reminder"),
            'report_company_name': self.env.company.name,
            'followup_report_email_subject': self._get_default_email_subject(options),
            'followup_line': self.get_followup_line(options),
            'options': options,
            'context': self.env.context,
            'model': self,
            'table_end': markupsafe.Markup('''
                </tbody></table>
                <div style="page-break-after: always"></div>
                <table class="o_account_reports_table table-hover">
            '''),
            'table_start': markupsafe.Markup('<tbody>'),
        }

    @api.model
    def _followup_report_format_aml_name(self, line_name, move_ref, move_name=None):
        """ Format the display of an account.move.line record. As its very costly to fetch the account.move.line
        records, only line_name, move_ref, move_name are passed as parameters to deal with sql-queries more easily.

        :param line_name:   The name of the account.move.line record.
        :param move_ref:    The reference of the account.move record.
        :param move_name:   The name of the account.move record.
        :return:            The formatted name of the account.move.line record.
        """
        names = []
        if move_name is not None and move_name != '/':
            names.append(move_name)
        if move_ref and move_ref != '/':
            names.append(move_ref)
        if line_name and line_name != move_name and line_name != '/':
            names.append(line_name)
        name = '-'.join(names)
        return name

    def _get_line_info(self, followup_line):
        return {
            'id': followup_line.id,
            'name': followup_line.name,
            'print_letter': followup_line.print_letter,
            'send_email': followup_line.send_email,
            'send_sms': followup_line.send_sms,
            'manual_action': followup_line.manual_action,
            'manual_action_note': followup_line.manual_action_note,
        }

    @api.model
    def get_followup_line(self, options):
        if not options.get('followup_level'):
            partner = self.env['res.partner'].browse(options.get('partner_id'))
            options['followup_level'] = (partner.followup_level.id, partner.followup_level.delay)
        if options.get('followup_level'):
            followup_line = self.env['account_followup.followup.line'].browse(options['followup_level'][0])
            return followup_line
        return False

    def _get_caret_options(self):
        # Method needed by the account_reports.main_template template, but unused for the followup report
        return {}

    ####################################################
    # DEFAULT SUMMARY AND EMAIL SUBJECT
    ####################################################

    @api.model
    def _get_sms_summary(self, options):
        partner = self.env['res.partner'].browse(options.get('partner_id'))
        level = partner.followup_level
        options = dict(options, followup_level=(level.id, level.delay))
        return self._build_followup_summary_with_field('sms_description', options)

    @api.model
    def _get_default_summary(self, options):
        return self._build_followup_summary_with_field('description', options)

    @api.model
    def _get_default_email_subject(self, options):
        return self._build_followup_summary_with_field('email_subject', options)

    @api.model
    def _build_followup_summary_with_field(self, field, options):
        """
        Build the followup summary based on the relevent followup line.
        :param field: followup line field used as the summary "template"
        :param options: dict that should contain the followup level and the partner
        :return: the summary if a followup line exists or None
        """
        followup_line = self.get_followup_line(options)
        if followup_line:
            partner = self.env['res.partner'].browse(options['partner_id'])
            lang = partner.lang or get_lang(self.env).code
            summary = followup_line.with_context(lang=lang)[field]
            if summary:
                try:
                    summary = summary % {'partner_name': partner.name,
                                         'date': format_date(self.env, fields.Date.today(), lang_code=partner.lang),
                                         'user_signature': html2plaintext(self.env.user.signature or ''),
                                         'company_name': self.env.company.name,
                                         'amount_due': formatLang(self.env, partner.total_due, currency_obj=self.env.company.currency_id),
                                        }
                except ValueError as exception:
                    message = _("An error has occurred while formatting your followup letter/email. (Lang: %s, Followup Level: #%s) \n\nFull error description: %s") \
                            % (lang, followup_line.id, exception)
                    raise ValueError(message)
                return summary
            else:
                return ''
        raise UserError(_('You need a least one follow-up level in order to process your follow-up'))

    ####################################################
    # REPORT DATA
    ####################################################

    def _get_followup_report_columns_name(self):
        """
        Return the name of the columns of the follow-ups report
        """
        headers = [
            {},
            {'name': _('Date'), 'class': 'date', 'style': 'text-align:center; white-space:nowrap;'},
            {'name': _('Due Date'), 'class': 'date', 'style': 'text-align:center; white-space:nowrap;'},
            {'name': _('Source Document'), 'style': 'text-align:center; white-space:nowrap;'},
            {'name': _('Communication'), 'style': 'text-align:right; white-space:nowrap;'},
            {'name': _('Expected Date'), 'class': 'date', 'style': 'white-space:nowrap;'},
            {'name': _('Excluded'), 'class': 'date', 'style': 'white-space:nowrap;'},
            {'name': _('Total Due'), 'class': 'number o_price_total', 'style': 'text-align:right; white-space:nowrap;'},
        ]
        if self.env.context.get('print_mode'):
            headers = headers[:5] + headers[7:]  # Remove the 'Expected Date' and 'Excluded' columns
        return headers

    ####################################################
    # EXPORT
    ####################################################

    @api.model
    def send_sms(self, options):
        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'name': _("Send SMS Text Message"),
            'res_model': 'sms.composer',
            'target': 'new',
            'views': [(False, "form")],
            'context': {
                'default_body': self._get_sms_summary(options),
                'default_res_model': 'res.partner',
                'default_res_id': options.get('partner_id'),
                'default_composition_mode': 'comment',
            },
        }

    @api.model
    def send_email(self, options):
        """
        Send by mail the followup to the customer
        """
        partner = self.env['res.partner'].browse(options.get('partner_id'))
        non_blocked_amls = partner.unreconciled_aml_ids.filtered(lambda aml: not aml.blocked)
        if not non_blocked_amls:
            return True
        non_printed_invoices = partner.unpaid_invoices.filtered(lambda inv: not inv.message_main_attachment_id)
        if non_printed_invoices and partner.followup_level.join_invoices:
            raise UserError(_('You are trying to send a followup report to a partner for which you didn\'t print all the invoices ({})').format(" ".join(non_printed_invoices.mapped('name'))))
        invoice_partner = self.env['res.partner'].browse(partner.address_get(['invoice'])['invoice'])
        email = invoice_partner.email
        if email and email.strip():
            self = self.with_context(lang=partner.lang or self.env.user.lang)
            # When printing we need te replace the \n of the summary by <br /> tags
            body_html = self.with_context(print_mode=True, mail=True).get_followup_report_html(options)
            body_html = body_html.replace('o_account_reports_edit_summary_pencil', 'o_account_reports_edit_summary_pencil d-none')
            start_index = body_html.find('<span>', body_html.find('<div class="o_account_reports_summary">'))
            end_index = start_index > -1 and body_html.find('</span>', start_index) or -1
            if end_index > -1:
                replaced_msg = body_html[start_index:end_index].replace('\n', '')
                body_html = body_html[:start_index] + replaced_msg + body_html[end_index:]
            partner.with_context(mail_post_autofollow=True, lang=partner.lang or self.env.user.lang).message_post(
                partner_ids=[invoice_partner.id],
                body=body_html,
                subject=self._get_default_email_subject(options),
                subtype_id=self.env.ref('mail.mt_note').id,
                model_description=_('payment reminder'),
                email_layout_xmlid='mail.mail_notification_light',
                attachment_ids=partner.followup_level.join_invoices and partner.unpaid_invoices.message_main_attachment_id.ids or [],
            )
            return True
        raise UserError(_('Could not send mail to partner %s because it does not have any email address defined', partner.display_name))

    @api.model
    def print_followups(self, records):
        """
        Print one or more followups in one PDF
        records contains either a list of records (come from an server.action) or a field 'ids' which contains a list of one id (come from JS)
        """
        res_ids = records['ids'] if 'ids' in records else records.ids  # records come from either JS or server.action
        action = self.env.ref('account_followup.action_report_followup').report_action(res_ids)
        if action.get('type') == 'ir.actions.report':
            for partner in self.env['res.partner'].browse(res_ids):
                partner.message_post(body=_('Follow-up letter printed'))
        return action

    ####################################################
    # PARTNER ACTION
    ####################################################

    @api.model
    def do_manual_action(self, options):
        msg = _('Manual action done')
        partner = self.env['res.partner'].browse(options.get('partner_id'))
        if options.get('followup_level'):
            followup_line = self.env['account_followup.followup.line'].browse(options.get('followup_level'))
            if followup_line:
                msg += '<br>' + followup_line.manual_action_note
        partner.message_post(body=msg)
