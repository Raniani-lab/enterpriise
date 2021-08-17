# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class ReportExportWizardOption(models.TransientModel):
    _inherit = 'account_reports.export.wizard.format'

    def apply_export(self, report_options):
        self.ensure_one()
        report = self.export_wizard_id._get_report_obj()
        if self.name == 'XML' and report._name == 'account.assets.report' and self.export_wizard_id.report_model == 'account.assets.report':
            return self.env['account.report'].print_xml(report_options)
        return super(ReportExportWizardOption, self).apply_export(report_options)
