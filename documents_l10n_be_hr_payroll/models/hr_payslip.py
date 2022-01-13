#-*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models

class Payslip(models.Model):
    _inherit = 'hr.payslip'

    @api.model
    def _cron_generate_pdf(self):
        is_rescheduled = super()._cron_generate_pdf()
        if is_rescheduled:
            return is_rescheduled

        lines = self.env['l10n_be.281_10.line'].search([('pdf_to_post', '=', True)])
        if not lines:
            return
        BATCH_SIZE = 30
        lines_batch = lines[:BATCH_SIZE]
        lines_batch._post_pdf()
        lines_batch.write({'pdf_to_post': False})
        # if necessary, retrigger the cron to generate more pdfs
        if len(lines) > BATCH_SIZE:
            self.env.ref('hr_payroll.ir_cron_generate_payslip_pdfs')._trigger()
            return True
