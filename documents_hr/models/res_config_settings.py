# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    documents_hr_settings = fields.Boolean(
        related='company_id.documents_hr_settings', readonly=False, string="Payroll")
    documents_hr_folder = fields.Many2one(
        'documents.folder', related='company_id.documents_hr_folder', readonly=False, string="hr default workspace")
    documents_hr_contracts_tags = fields.Many2many(
        'documents.tag', 'documents_hr_contracts_tags_table', related='company_id.documents_hr_contracts_tags',
        readonly=False, string="Contracts")
    documents_hr_payslips_tags = fields.Many2many(
        'documents.tag', 'documents_hr_payslips_tags_table', related='company_id.documents_hr_payslips_tags',
        readonly=False, string="Payslips")

    @api.onchange('documents_hr_folder')
    def on_hr_folder_change(self):
        if (self.documents_hr_folder != self.documents_hr_contracts_tags.mapped('folder_id') or
                self.documents_hr_folder != self.documents_hr_payslips_tags.mapped('folder_id')):
            self.documents_hr_contracts_tags = False
            self.documents_hr_payslips_tags = False
