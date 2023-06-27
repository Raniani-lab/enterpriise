# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class ReportL10nHkHrPayrollIr56b(models.AbstractModel):
    _name = 'report.l10n_hk_hr_payroll.report_ir56b'
    _description = 'Get IR56b report as PDF.'

    @api.model
    def _get_report_values(self, docids, data=None):
        return {
            'doc_ids': docids,
            'doc_model': self.env['hr.employee'],
            'data': data,
            'docs': self.env['hr.employee'].browse(docids),
        }

class ReportL10nHkHrPayrollIr56e(models.AbstractModel):
    _name = 'report.l10n_hk_hr_payroll.report_ir56e'
    _description = 'Get IR56e report as PDF.'

    @api.model
    def _get_report_values(self, docids, data=None):
        return {
            'doc_ids': docids,
            'doc_model': self.env['hr.employee'],
            'data': data,
            'docs': self.env['hr.employee'].browse(docids),
        }

class ReportL10nHkHrPayrollIr56f(models.AbstractModel):
    _name = 'report.l10n_hk_hr_payroll.report_ir56f'
    _description = 'Get IR56f report as PDF.'

    @api.model
    def _get_report_values(self, docids, data=None):
        return {
            'doc_ids': docids,
            'doc_model': self.env['hr.employee'],
            'data': data,
            'docs': self.env['hr.employee'].browse(docids),
        }

class ReportL10nHkHrPayrollIr56g(models.AbstractModel):
    _name = 'report.l10n_hk_hr_payroll.report_ir56g'
    _description = 'Get IR56g report as PDF.'

    @api.model
    def _get_report_values(self, docids, data=None):
        return {
            'doc_ids': docids,
            'doc_model': self.env['hr.employee'],
            'data': data,
            'docs': self.env['hr.employee'].browse(docids),
        }
