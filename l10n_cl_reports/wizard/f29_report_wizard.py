# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields, _


class F29ReportWizard(models.TransientModel):
    _name = 'f29.report.wizard'
    _description = 'F29 Report Wizard'

    def _default_tasa_ppm(self):
        return self.env.company.l10n_cl_report_tasa_ppm

    tasa_ppm = fields.Integer(string="Tasa PPM (%)",
                              default=_default_tasa_ppm)

    def show_report(self):
        report = self.env.ref('l10n_cl_reports.account_financial_report_f29')
        return {
            'type': 'ir.actions.client',
            'name': _('F29 Report'),
            'tag': 'account_report',
            'context': {
                'model': 'account.financial.html.report',
                'id': report.id,
                'tasa_ppm': self.tasa_ppm,
            }
        }
