# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import re

from odoo import api, models, _
from odoo.tools import street_split


class GeneralLedgerCustomHandler(models.AbstractModel):
    _inherit = 'account.general.ledger.report.handler'

    def _custom_options_initializer(self, report, options, previous_options=None):
        super()._custom_options_initializer(report, options, previous_options)
        if self.env.company.account_fiscal_country_id.code == 'DK':
            options.setdefault('buttons', []).append({
                'name': _('SAF-T'),
                'sequence': 50,
                'action': 'export_file',
                'action_param': 'l10n_dk_export_saft_to_xml',
                'file_export_type': _('XML')
            })

    @api.model
    def l10n_dk_export_saft_to_xml(self, options):
        report = self.env['account.report'].browse(options['report_id'])
        template_vals = report._l10n_dk_saft_prepare_report_values(options)
        content = self.env['ir.qweb']._render('l10n_dk_reports.saft_template', template_vals)
        self.env['ir.attachment'].l10n_dk_saft_validate_xml_from_attachment(content)
        return {
            'file_name': "l10n_dk_SAF-T_export.xml",
            'file_content': "\n".join(re.split(r'\n\s*\n', content)).encode(),
            'file_type': 'xml',
        }


class AccountGeneralLedger(models.AbstractModel):
    _inherit = "account.report"

    @api.model
    def _l10n_dk_saft_prepare_report_values(self, options):
        template_vals = self._saft_prepare_report_values(options)
        template_vals.update({
            'xmlns': "urn:StandardAuditFile-Taxation-Financial:DK",
            'file_version': '1.0',
            'street_split': street_split,
        })
        for tax in template_vals['tax_vals_list']:
            # The documentation describes the `EffectiveDate` as "Representing the starting date for this entry."
            # The postgres `create_date` is the date from which the record can be used in the system and thus is the
            # more suitable one in this context.
            tax['effective_date'] = tax['create_date'].strftime('%Y-%m-%d')
        return template_vals

    def _saft_get_account_type(self, account_type):
        # OVERRIDE account_saft/models/account_general_ledger
        if self.env.company.account_fiscal_country_id.code != 'DK':
            return super()._saft_get_account_type(account_type)

        # possible type: Asset/Liability/Sale/Expense/Other
        account_type_dict = {
            "asset_receivable": 'Asset',
            "asset_cash": 'Asset',
            "asset_current": 'Asset',
            "asset_non_current": 'Asset',
            "asset_prepayments": 'Asset',
            "asset_fixed": 'Asset',
            "liability_payable": 'Liability',
            "liability_credit_card": 'Liability',
            "liability_current": 'Liability',
            "liability_non_current": 'Liability',
            "equity": 'Liability',
            "equity_unaffected": 'Liability',
            "income": 'Sale',
            "income_other": 'Sale',
            "expense": 'Expense',
            "expense_depreciation": 'Expense',
            "expense_direct_cost": 'Expense',
            "off_balance": 'Other',
        }
        return account_type_dict[account_type]
