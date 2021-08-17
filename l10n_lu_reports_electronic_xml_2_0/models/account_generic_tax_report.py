# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models

class AccountGenericTaxReport(models.AbstractModel):
    _inherit = "account.generic.tax.report"

    filter_journals = True

    def _get_reports_buttons(self, options):
        res = super()._get_reports_buttons(options)
        if self._is_lu_electronic_report(options):
            for re in res:
                if re.get('action') == 'print_xml':
                    # deactivate xml export & saving
                    # and allow export of the XML declaration from the wizard
                    re['action'] = 'l10n_lu_open_report_export_wizard'
                    del re['file_export_type']
        return res

    def l10n_lu_open_report_export_wizard(self, options):
        """ Creates a new export wizard for this report."""
        new_context = self.env.context.copy()
        new_context['tax_report_options'] = options
        tax_report = self.env['l10n_lu.generate.tax.report'].with_context(new_context).create({})
        if tax_report.period != 'A':
            return tax_report.get_xml()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Export'),
            'view_mode': 'form',
            'res_model': 'l10n_lu.generate.tax.report',
            'target': 'new',
            'views': [[self.env.ref('l10n_lu_reports_electronic_xml_2_0.view_l10n_lu_generate_tax_report').id, 'form']],
            'context': new_context,
        }
