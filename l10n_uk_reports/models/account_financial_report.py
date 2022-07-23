# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, _


class TaxFinancialReport(models.Model):
    _inherit = 'account.report'

    def _custom_options_initializer_tax_report(self, options, previous_options=None):
        super()._custom_options_initializer_tax_report(options)
        if self.env.company.account_fiscal_country_id.code == 'GB' and self.availability_condition == 'always':
            # If token, but no refresh_token, check if you got the refresh_token on the server first
            # That way, you can see immediately if your login was successful after logging in
            # and the label of the button will be correct
            if self.env.user.l10n_uk_user_token and not self.env.user.l10n_uk_hmrc_vat_token:
                self.env['hmrc.service']._login()
            button_name = _('Send to HMRC') if self.env.user.l10n_uk_hmrc_vat_token else _('Connect to HMRC')
            options['buttons'].append({'name': button_name, 'action': 'send_hmrc', 'sequence': 50})

    def send_hmrc(self, options):
        # do the login if there is no token for the current user yet.
        if not self.env.user.l10n_uk_hmrc_vat_token:
            return self.env['hmrc.service']._login()

        # Show wizard when sending to HMRC
        context = self.env.context.copy()
        context.update({'options': options})
        view_id = self.env.ref('l10n_uk_reports.hmrc_send_wizard_form').id
        return {'type': 'ir.actions.act_window',
                'name': _('Send to HMRC'),
                'res_model': 'l10n_uk.hmrc.send.wizard',
                'target': 'new',
                'view_mode': 'form',
                'views': [[view_id, 'form']],
                'context': context,
        }
