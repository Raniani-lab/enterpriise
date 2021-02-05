# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class ContractHistory(models.Model):
    _inherit = 'hr.contract.history'

    wage_type = fields.Selection(related='structure_type_id.wage_type', readonly=True)
    payslips_count = fields.Integer("# Payslips", compute='_compute_payslips_count', groups="hr_payroll.group_hr_payroll_user")

    def _compute_payslips_count(self):
        for history in self:
            history.payslips_count = sum(contract.payslips_count for contract in history.contract_ids)

    def action_open_payslips(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("hr_payroll.action_view_hr_payslip_month_form")
        action.update({'domain': [('contract_id', 'in', self.contract_ids.ids)]})
        return action
